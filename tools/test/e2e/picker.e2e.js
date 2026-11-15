// The solution picker site in a real headless Chrome (REQ-105, criteria 1-9;
// docs/design/REQ-105-e2e-picker.md, 4.4 and 8). Every test starts its own picker
// server (withStand) and its own browser (withBrowser) and shares nothing with
// another test. The oracles are the server's own answers (GET …/api/questionnaire,
// a direct POST of the same answers with the header Origin), the tenant files and the
// answer sets of src/picker/demo-*, and the numbers and words of the requirement;
// the code of the page is never read. Every wait is for a fact, with a limit.
// Run by `cd tools && npm run e2e -- picker`.
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { withBrowser, withStand } from "./kit/index.js";

const LIMIT = { timeout: 30000 };
const TOOLS = fileURLToPath(new URL("../../", import.meta.url));
const OLD_TENANTS = "src/picker/demo-tenants";
const NEW_TENANTS = "src/picker/demo-tenants-v3";
const NOT_FOUND_404 =
  "Failed to load resource: the server responded with a status of 404 (Not Found)";
// The browser's own line for the missing /favicon.ico (the server answers 404 there,
// README "The server"): the first load of a fresh profile writes it, once.
const FAVICON = {
  kind: "browser-log",
  text: NOT_FOUND_404,
  path: "/favicon.ico",
};
// The browser's own line for a request that found no server (criterion 8): one per
// failed request of the result, declared with its path.
const REFUSED = {
  kind: "browser-log",
  text: "Failed to load resource: net::ERR_CONNECTION_REFUSED",
  path: "/t/uchet-pro/api/result",
};
// The words of the requirement (criteria 7 and 8).
const NOT_FOUND_LINE =
  "Страница не найдена. / Бет табылмады. / Page not found.";
const LOST_NET = "Нет связи. Ваши ответы сохранены. Попробуйте ещё раз.";
const RETRY = "Повторить";
const LANGS = ["ru", "kk", "en"];
const SCHEMES = ["light", "dark"];
const WINDOWS = [
  [1470, 784],
  [390, 844],
  [320, 568],
];
const TENANT_KEY = "sai-picker:uchet-pro";

// The options of a picker server (design 4.2) on the folder of tenants `tenantsDir`.
function pickerStand(tenantsDir) {
  return {
    name: "picker",
    args: [
      "src/picker/cli.js",
      "serve",
      "--tenants",
      tenantsDir,
      "--port",
      "0",
    ],
    readyPattern: /(http:\/\/127\.0\.0\.1:\d+)\/t\//u,
  };
}

// A file of tools/ (an answer set, a tenant file), parsed.
function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(TOOLS, relativePath), "utf8"));
}

async function getJson(origin, urlPath) {
  const answer = await fetch(`${origin}${urlPath}`);
  assert.equal(answer.status, 200, urlPath);
  return answer.json();
}

// The answer of the server to the answers `set`, asked by the test itself.
async function directPost(origin, id, lang, set) {
  const answer = await fetch(`${origin}/t/${id}/api/result?lang=${lang}`, {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify({ answers: set }),
  });
  return { status: answer.status, text: await answer.text() };
}

// Page code that finds one element by a CSS selector.
function query(selector) {
  return `document.querySelector(${JSON.stringify(selector)})`;
}

function textOf(selector) {
  return `(${query(selector)} || { textContent: null }).textContent`;
}

const CARD_READY = `${query('[data-screen="card"] [data-action="start"]')} !== null`;
const QUESTION_TITLE = textOf('[data-screen="question"] #q-title');

async function waitForCard(page, what) {
  await page.waitFor(CARD_READY, {
    description: `the card with its start button (${what})`,
  });
}

// A load with an empty storage of the origin: after one pass the origin keeps the
// answers, and the next load would show «Продолжить» instead of the start button.
async function startFresh(page, url) {
  await page.goto(url);
  await page.evaluate("localStorage.clear()");
  await page.reload();
}

function optionSelector(id) {
  return `[data-part="option"]:has(input[value=${JSON.stringify(id)}])`;
}

// The answer `value` to `question` on the screen: the option rows of a single or a
// multiple choice, or the number typed into the field.
async function answer(page, question, value) {
  if (question.type === "number") {
    await page.type("#q-input", String(value));
    return;
  }
  const ids = question.type === "single" ? [value] : value;
  for (const id of ids) await page.click(optionSelector(id));
}

// The questions of a questionnaire by their titles, which must be unique.
function byTitleOf(questionnaire, what) {
  const byTitle = new Map(questionnaire.questions.map((q) => [q.title, q]));
  assert.equal(
    byTitle.size,
    questionnaire.questions.length,
    `${what}: the titles of the questionnaire are unique`,
  );
  return byTitle;
}

// The question on the screen, found by its title.
async function questionOnScreen(page, byTitle, what) {
  const title = await page.waitFor(QUESTION_TITLE, {
    description: `${what}: a question on the screen`,
  });
  const question = byTitle.get(title);
  assert.ok(
    question,
    `${what}: a title the questionnaire does not have: ${title}`,
  );
  return question;
}

// After a press on a button of `question`: waits until the screen shows another
// question or the result. -> "result" or "question".
async function screenAfter(page, question, what) {
  return page.waitFor(
    `(() => {
      if (${query('[data-screen="result"]')}) return "result";
      const title = ${textOf("#q-title")};
      return title !== null && title !== ${JSON.stringify(question.title)} ? "question" : null;
    })()`,
    { description: `${what}: the screen after the question ${question.id}` },
  );
}

// Answers the questionnaire on the page from `set` until the result screen: the
// question on the screen is found by its title in the server's questionnaire, a
// question the set does not answer is skipped (it must not be required), and the
// main button is pressed. -> the ids of the questions met, in order.
async function answerAll(page, questionnaire, set, what) {
  const byTitle = byTitleOf(questionnaire, what);
  const met = [];
  for (let step = 0; step < 40; step += 1) {
    const question = await questionOnScreen(page, byTitle, what);
    met.push(question.id);
    if (Object.hasOwn(set, question.id)) {
      await answer(page, question, set[question.id]);
      await page.click('form [data-part="next"]');
    } else {
      assert.equal(
        question.required,
        false,
        `${what}: the set has no answer to the required question ${question.id}`,
      );
      await page.click('[data-action="skip"]');
    }
    if ((await screenAfter(page, question, what)) === "result") return met;
  }
  return assert.fail(`${what}: no result screen after 40 questions`);
}

// Answers from `set` up to the last question and answers that one too, without the
// press that would ask for the result. -> the last question.
async function answerUpToLast(page, questionnaire, set, what) {
  const byTitle = byTitleOf(questionnaire, what);
  for (let step = 0; step < 40; step += 1) {
    const question = await questionOnScreen(page, byTitle, what);
    assert.ok(
      Object.hasOwn(set, question.id),
      `${what}: the set has no answer to ${question.id}`,
    );
    await answer(page, question, set[question.id]);
    const action = await page.evaluate(
      `${query('form [data-part="next"]')}.getAttribute("data-action")`,
    );
    if (action === "show-result") return question;
    await page.click('form [data-part="next"]');
    assert.equal(await screenAfter(page, question, what), "question", what);
  }
  return assert.fail(`${what}: no last question after 40 questions`);
}

// The one POST of the page (the request of the result), with its body as the page got it.
async function resultRecord(page, what) {
  const posts = page.network().filter((record) => record.method === "POST");
  assert.equal(posts.length, 1, `${what}: the page sent one POST`);
  const [post] = posts;
  assert.equal(post.status, 200, `${what}: the status of the result`);
  return { ...post, body: await page.responseBody(post.requestId) };
}

// Waits until the question on the screen is `question` (by its title).
async function atQuestion(page, question, what) {
  await page.waitFor(
    `${QUESTION_TITLE} === ${JSON.stringify(question.title)}`,
    { description: `${what}: the question ${question.id}` },
  );
}

// Polls a fact of this process (the records of the network, the console entries)
// until it is true, at most `ms`.
async function until(check, ms, what) {
  const deadline = performance.now() + ms;
  for (;;) {
    const value = check();
    if (value) return value;
    if (performance.now() > deadline) {
      assert.fail(`${what} did not happen in ${ms} ms`);
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

// The WCAG 2.x contrast ratio, from its table of constants. 0.03928 is the number of
// WCAG 2.x; no 8-bit channel value lies between it and the newer 0.04045.
const WCAG = {
  threshold: 0.03928,
  linearDivisor: 12.92,
  offset: 0.055,
  scale: 1.055,
  power: 2.4,
  red: 0.2126,
  green: 0.7152,
  blue: 0.0722,
  flare: 0.05,
};

function luminance([red, green, blue]) {
  const linear = (channel) => {
    const s = channel / 255;
    return s <= WCAG.threshold
      ? s / WCAG.linearDivisor
      : ((s + WCAG.offset) / WCAG.scale) ** WCAG.power;
  };
  return (
    WCAG.red * linear(red) +
    WCAG.green * linear(green) +
    WCAG.blue * linear(blue)
  );
}

function contrast(foreground, background) {
  const [high, low] = [luminance(foreground), luminance(background)].sort(
    (a, b) => b - a,
  );
  return (high + WCAG.flare) / (low + WCAG.flare);
}

// Page code: the colours of the card. The background of an element is the first
// colour with an alpha above 0 met from the element up its parents, a partly
// transparent one laid over the ones below it, and white under all; a text colour is
// laid over the background of its element.
const CARD_COLOURS = `(() => {
  const parse = (text) => {
    const n = text.match(/[0-9.]+/g).map(Number);
    return { rgb: n.slice(0, 3), alpha: n.length > 3 ? n[3] : 1 };
  };
  const over = (top, under) =>
    top.rgb.map((c, i) => c * top.alpha + under[i] * (1 - top.alpha));
  const effectiveBackground = (element) => {
    const layers = [];
    for (let node = element; node; node = node.parentElement) {
      const layer = parse(getComputedStyle(node).backgroundColor);
      if (layer.alpha > 0) layers.push(layer);
      if (layer.alpha === 1) break;
    }
    let colour = [255, 255, 255];
    for (const layer of layers.reverse()) colour = over(layer, colour);
    return colour;
  };
  const pair = (element) => {
    const back = effectiveBackground(element);
    return { text: over(parse(getComputedStyle(element).color), back), back };
  };
  return {
    dark: matchMedia("(prefers-color-scheme: dark)").matches,
    bodyBackground: getComputedStyle(document.body).backgroundColor,
    body: pair(document.body),
    intro: pair(${query('[data-part="intro"]')}),
  };
})()`;

// Page code: what holds the focus. A visible ring is an outline whose style is not
// "none" and whose width is above 0, or a box shadow: the computed outline width is
// 3px even when the style is "none", so the width alone tells nothing. The ring of a
// radio button may stand on its option row.
const FOCUS_INFO = `(() => {
  const element = document.activeElement;
  const ringOf = (node) => {
    const style = getComputedStyle(node);
    return (
      (style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0) ||
      style.boxShadow !== "none"
    );
  };
  const row = element.closest('[data-part="option"]');
  const screen = element.closest("[data-screen]");
  return {
    tag: element.tagName,
    id: element.id,
    action: element.getAttribute("data-action"),
    type: element.getAttribute("type"),
    screen: screen === null ? null : screen.getAttribute("data-screen"),
    ring: ringOf(element) || (row !== null && ringOf(row)),
    live: document.getElementById("live").textContent,
    progress: ${textOf('[data-part="progress-text"]')},
  };
})()`;

// Presses Tab until `wanted` holds the focus (a data-action, or the type "radio" or
// "number" of the field of a question), at most `maxTabs` times; every control met
// on the way must show a visible ring. -> what holds the focus at the end.
async function tabTo(page, wanted, maxTabs, what) {
  const met = [];
  for (let press = 0; press < maxTabs; press += 1) {
    await page.press("Tab");
    const focus = await page.evaluate(FOCUS_INFO);
    const name = focus.action ?? focus.type ?? focus.tag;
    met.push(name);
    assert.equal(
      focus.ring,
      true,
      `${what}: no visible ring on ${name} (Tab met: ${met.join(", ")})`,
    );
    if (focus.action === wanted || focus.type === wanted) return focus;
  }
  return assert.fail(
    `${what}: ${wanted} not reached with ${maxTabs} Tabs (met: ${met.join(", ")})`,
  );
}

// After a change of screen: the focus is inside the new screen, and on a question
// the live region says what the progress line says.
function assertMoved(focus, screen, what) {
  assert.equal(
    focus.screen,
    screen,
    `${what}: the focus is outside the screen`,
  );
  assert.notEqual(focus.live, "", `${what}: the live region is empty`);
  if (screen === "question") {
    assert.equal(focus.id, "q-title", `${what}: the focus is on the title`);
    assert.equal(focus.live, focus.progress, `${what}: the live region`);
  }
}

const CHECKED_VALUES = `[...document.querySelectorAll('[data-screen="question"] input:checked')].map((input) => input.value)`;

// Page code: the whole storage of the origin, read key by key, and the other places
// a page could keep something.
const STORAGE_STATE = `(() => {
  const keys = [];
  for (let i = 0; i < localStorage.length; i += 1) keys.push(localStorage.key(i));
  return {
    keys,
    values: Object.fromEntries(keys.map((key) => [key, localStorage.getItem(key)])),
    session: sessionStorage.length,
    cookie: document.cookie,
  };
})()`;

// The rule «no free text, no contact data» on a stored text: no "@" and no run of
// seven digits. It is applied to the parts of the value the visitor can influence;
// the version is a hash of the questionnaire and may hold seven digits in a row.
function noContactData(text) {
  return !text.includes("@") && !/[0-9]{7}/u.test(text);
}

// The texts of a questionnaire that a visitor reads, by their place: the name, the
// intro, and the title, help, unit and option labels of each question. `textOf` reads
// one text where it stands (asServed in an answer of the server, russianOf in a tenant
// file); `who` names the source in a message.
function visitorTexts(questionnaire, textOf, who) {
  const out = {
    name: textOf(questionnaire.name, `${who}: the name`),
    intro: textOf(questionnaire.intro, `${who}: the intro`),
  };
  questionnaire.questions.forEach((question, index) => {
    const at = `question ${index + 1} (${question.id})`;
    out[`${at}: title`] = textOf(question.title, `${who}: ${at}: the title`);
    for (const field of ["help", "unit"]) {
      if (question[field] !== undefined) {
        out[`${at}: ${field}`] = textOf(
          question[field],
          `${who}: ${at}: the ${field}`,
        );
      }
    }
    for (const option of question.options ?? []) {
      out[`${at}: option ${option.id}`] = textOf(
        option.label,
        `${who}: ${at}: the option ${option.id}`,
      );
    }
  });
  return out;
}

// A text of an answer of the server: the string itself.
function asServed(text, what) {
  assert.equal(typeof text, "string", `${what}: not a string`);
  return text;
}

// The Russian text of a field of a tenant file: the files of the demo folders hold
// every text in ru, kk and en.
function russianOf(text, what) {
  assert.equal(typeof text?.ru, "string", `${what}: no Russian text`);
  return text.ru;
}

// The different texts of visitorTexts, without an empty one.
function textSet(texts) {
  const out = new Set(Object.values(texts));
  out.delete("");
  return out;
}

// The texts of A (its questionnaire as the server gives it) that tenant B does not
// have. B's texts come from B's tenant file in ru, not from B's answer of the server
// under test (decisions/0109, О17): a text of A that the server served in B's
// questionnaire would leave the set and so hide its own leak.
function exclusiveStrings(questionnaireA, tenantFileB) {
  const ofB = textSet(visitorTexts(tenantFileB, russianOf, tenantFileB.id));
  return [
    ...textSet(
      visitorTexts(questionnaireA, asServed, "the questionnaire of A"),
    ),
  ].filter((s) => !ofB.has(s));
}

// Every string value of a parsed JSON value with its place, at any depth.
function placedStrings(value, place) {
  if (typeof value === "string") return [[place, value]];
  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      placedStrings(item, `${place}[${index}]`),
    );
  }
  if (value !== null && typeof value === "object") {
    return Object.entries(value).flatMap(([key, item]) =>
      placedStrings(item, place === "" ? key : `${place}.${key}`),
    );
  }
  return [];
}

// Every object key of a parsed JSON value with its place, at any depth.
function placedKeys(value, place) {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      placedKeys(item, `${place}[${index}]`),
    );
  }
  if (value !== null && typeof value === "object") {
    return Object.entries(value).flatMap(([key, item]) => {
      const at = place === "" ? key : `${place}.${key}`;
      return [[at, key], ...placedKeys(item, at)];
    });
  }
  return [];
}

// Every string value of a JSON text, at any depth.
function stringValues(jsonText) {
  return placedStrings(JSON.parse(jsonText), "").map(([, text]) => text);
}

// The names of the solutions of a tenant file, in every language.
function solutionNames(tenantFile) {
  return tenantFile.solutions.flatMap((solution) =>
    Object.values(solution.name),
  );
}

// A text of more than one word: it has a blank.
function hasBlank(text) {
  return /\s/u.test(text);
}

// The Russian texts of a tenant file at any depth (questions, solutions, rules,
// hypotheses, result texts, leads, look): the ru of every text in languages.
function russianTexts(tenantFile) {
  const out = [];
  const walk = (value) => {
    if (Array.isArray(value)) value.forEach(walk);
    else if (value !== null && typeof value === "object") {
      if (typeof value.ru === "string") out.push(value.ru);
      else Object.values(value).forEach(walk);
    }
  };
  walk(tenantFile);
  return out;
}

// The one-word texts of A that stand as a part inside a Russian text of B's tenant
// file (decisions/0109, О17 as corrected after the second pass of the gate): the only
// texts of A that assertNothingOf compares with whole string values.
function commonWords(textsOfA, tenantFileB) {
  const ofB = russianTexts(tenantFileB);
  return textsOfA.filter(
    (text) => !hasBlank(text) && ofB.some((own) => own.includes(text)),
  );
}

// An answer of the server to B holds nothing of A (criterion 6 as decisions/0109
// reads it: О17, corrected after the second pass of the gate, and О19). Every text of
// A is looked for as a part of every string value of the answer, whatever its length,
// except the words `common`: a one-word text of A that stands inside a Russian text of
// B's tenant file is compared with the whole string values only (О17 as corrected).
// Measured on the correct server: the unit «человек» of uchet-pro stands inside the
// option «Есть отдельный человек» of svet-marketing, in its file and in B's
// questionnaire answer; the option «Обучение» of agency inside the item «Обучение
// сотрудников» of a solution of stock, in its file and in B's result answer for the
// leader set; the option «Средний» of uchet-pro stands inside a rule text of
// svet-marketing's file and in none of B's answers for the leader set. The check of
// B's own strings (assertTextsOfFile, assertOwnStrings) catches such a word inside any
// string of B's answers. Every other one-word text of A, A's name among them, is
// looked for as a part like a text with a blank: as a whole value only, A's name
// inside a string of B was not seen (the gate's mutants N05 and N09). No solution name
// of A stands in the answer text. No key of the answer, at any depth, holds a text or a
// solution name of A, with no exception (О19; measured: no key of B's two answers or
// of the error answer holds one).
function assertNothingOf(jsonText, textsOfA, common, namesOfA, what) {
  const values = stringValues(jsonText);
  const whole = new Set(values);
  const wholeOnly = new Set(common);
  for (const text of textsOfA) {
    const held = wholeOnly.has(text)
      ? whole.has(text)
      : values.some((value) => value.includes(text));
    assert.ok(!held, `${what}: holds the text of A «${text}»`);
  }
  for (const name of namesOfA) {
    assert.ok(
      !jsonText.includes(name),
      `${what}: holds the solution «${name}»`,
    );
  }
  const keys = placedKeys(JSON.parse(jsonText), "");
  for (const text of [...textsOfA, ...namesOfA]) {
    for (const [place, key] of keys) {
      assert.ok(
        !key.includes(text),
        `${what}: the key at ${place} holds «${text}» of A`,
      );
    }
  }
}

// B's questionnaire answer shows B's own texts, each in its place (decisions/0109, the
// addendum after the second pass of the gate: a list of A's texts sees only the leaks
// it lists): the texts a visitor reads equal the ru texts of B's tenant file, field by
// field, so a text of A of any length placed in them, or put in place of one of them,
// makes them differ, whatever its words.
function assertTextsOfFile(questionnaireText, tenantFile, what) {
  const served = visitorTexts(JSON.parse(questionnaireText), asServed, what);
  const own = visitorTexts(tenantFile, russianOf, tenantFile.id);
  const places = [...new Set([...Object.keys(served), ...Object.keys(own)])];
  const differ = places.filter((place) => served[place] !== own[place]);
  assert.deepEqual(
    served,
    own,
    `${what}: not the texts of the tenant file at ${differ.join("; ")}`,
  );
}

// The top-level fields of an answer to B that the server makes itself and that hold
// no string of the tenant file, each with its own oracle; measured on the correct
// server in both pairs, every other string value of the two answers is a string of
// B's file. The questionnaire answer: `version` is the sha256 of the bytes of the
// file (design REQ-056, 5.2), `lang` the language asked, `languages` the languages of
// a file of the forms /2 and /3 (the keys of its texts, not their values). The result
// answer: none (its strings are the texts and ids of B's solutions, rules and
// hypotheses and the ids of the questions and options answered).
function composedFields(fileBytes) {
  return {
    questionnaire: { version: sha256(fileBytes), lang: "ru", languages: LANGS },
    result: {},
  };
}

// An answer of the server to B holds B's own strings only (the same addendum): every
// string value, at any depth, is a string value of B's tenant file (any field, any
// depth, any language), except in the top-level fields of `composed`, which hold the
// values given there. A text of A placed in the answer, inside a string or as a whole
// value, is no string of B's file, whatever its words, so a text that the list of A's
// texts does not hold (a result text of A, a word that B's texts also hold) is seen.
function assertOwnStrings(jsonText, tenantFile, composed, what) {
  const own = new Set(placedStrings(tenantFile, "").map(([, text]) => text));
  const answer = JSON.parse(jsonText);
  for (const [field, value] of Object.entries(composed)) {
    assert.deepEqual(answer[field], value, `${what}: the field ${field}`);
  }
  for (const [field, value] of Object.entries(answer)) {
    if (Object.hasOwn(composed, field)) continue;
    for (const [place, text] of placedStrings(value, field)) {
      assert.ok(
        own.has(text),
        `${what}: «${text}» at ${place} is not a string of the tenant file of B`,
      );
    }
  }
}

// The fields of the answers to B that are no key of a tenant file, each with its
// reason (decisions/0109, О19). Measured on the correct server in both pairs: every
// other key of B's questionnaire answer and of B's result answer is a key of B's
// tenant file. The error answer is held to its own fields only.
const ANSWER_FIELDS = {
  questionnaire: {
    version: "the sha256 of the bytes of the file (design REQ-056, 5.2)",
    lang: "the language asked",
    languages: "the languages of the file",
    questions_min: "the number of the questions without a condition",
    questions_max: "the number of all the questions",
    ai: "no advice by AI yet: always false",
    leads: "the application of the file, or null when it has none",
  },
  result: {
    clear_leader: "whether the first solution leads by the gap of the file",
    recommended: "the recommended solutions",
    score: "the points of a recommended solution",
    because: "the conditions of a fired rule with the answers to them",
    selected: "the options chosen, in a line of because",
    value: "the answer given, in a line of because",
  },
  error: {
    error: "the code of the error",
    message: "the text of the error for the visitor",
    question: "the question the answers failed on, or null",
  },
};

// The keys of an answer to B (decisions/0109, О19): every key, at any depth, is a key
// of B's tenant file (`keysOfB`) or a field of the answer named in `fields`, so a key
// that holds anything of A, a text, a name or an id, is seen.
function assertOwnKeys(jsonText, keysOfB, fields, what) {
  for (const [place, key] of placedKeys(JSON.parse(jsonText), "")) {
    assert.ok(
      keysOfB.has(key) || Object.hasOwn(fields, key),
      `${what}: the key «${key}» at ${place} is no key of the tenant file of B and no field of the answer`,
    );
  }
}

// Page code: what a visitor reads or hears on the screen (decisions/0109, О19): the
// screens on the page, the text of the page (the textContent of the root element: the
// body, the title and whatever stands outside the body), the title of the document,
// the value of every attribute of every element (aria-label, title, alt and
// placeholder among them, and also aria-valuetext of the progress bar, which a screen
// reader says too; measured on the correct server: no attribute of B's page holds a
// text or a solution name of A), the address of the page as the visitor reads it, the
// whole text of every element, and every text of the page as it stands (each text node).
const SCREEN_TEXTS = `(() => {
  const elements = [...document.querySelectorAll("*")];
  const attributes = [];
  for (const element of elements) {
    for (const attribute of element.attributes) attributes.push(attribute.value);
  }
  const pieces = [];
  const walker = document.createTreeWalker(
    document.documentElement,
    NodeFilter.SHOW_TEXT,
  );
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    if (node.data.trim() !== "") pieces.push(node.data);
  }
  let address = location.href;
  try {
    address = decodeURIComponent(address);
  } catch {
    // an escape that does not decode: the address as it stands
  }
  return {
    screens: [...document.querySelectorAll("[data-screen]")].map((screen) =>
      screen.getAttribute("data-screen"),
    ),
    text: document.documentElement.textContent,
    title: document.title,
    address,
    attributes,
    wholes: elements.map((element) => element.textContent),
    pieces,
  };
})()`;

// The Russian texts of B's tenant file that a screen of B's pass shows, by the places
// of visitorTexts: the name, in the header of every screen, and the places that start
// with `prefix`: the intro on the card, the texts of the question on its screen. The
// screen of the result shows the header and no other text of the file, because it is
// the placeholder of result.js (the description of REQ-105): no text of B's solutions
// or rules is on the page yet.
function shownTexts(textsOfB, prefix) {
  return Object.entries(textsOfB)
    .filter(
      ([place]) =>
        place === "name" || (prefix !== null && place.startsWith(prefix)),
    )
    .map(([, text]) => text);
}

// A screen of B's page shows nothing of A (criterion 6 as decisions/0109 reads it:
// О19). Every text and solution name of A is looked for as a part of the text of the
// page, of the title of the document, of the address and of each attribute. One that
// stands inside a text of B's file shown on this screen (`ownTexts`) is compared with
// the whole text of each element, the whole title, the whole address and each whole
// attribute value instead; and every text of the page (`pieces`), the title, the
// address and every attribute that holds it as a part must be one of those texts of B,
// so that such a word placed inside another text of the screen is seen too. -> where
// such words stand: "«<word>» in «<text of B>»".
function assertScreenNothingOf(shown, itemsOfA, ownTexts, what) {
  const holders = [];
  const others = [
    ["the title of the document", [shown.title]],
    ["the address of the page", [shown.address]],
    ["an attribute", shown.attributes],
  ];
  for (const item of itemsOfA) {
    const inOwn = ownTexts.filter((own) => own.includes(item));
    const whole = inOwn.length > 0;
    const places = [
      ["the text of the page", whole ? shown.wholes : [shown.text]],
      ...others,
    ];
    for (const [place, texts] of places) {
      const held = whole
        ? texts.some((text) => text.trim() === item)
        : texts.some((text) => text.includes(item));
      assert.ok(
        !held,
        `${what} shows «${item}» in ${place}${whole ? " as a whole text" : ""}`,
      );
    }
    if (!whole) continue;
    const parts = [["a text of the page", shown.pieces], ...others];
    for (const [place, texts] of parts) {
      for (const text of texts.filter((one) => one.includes(item))) {
        assert.ok(
          inOwn.includes(text.trim()),
          `${what} shows «${item}» inside «${text}» (${place}), no text of B's file on this screen`,
        );
        holders.push(`«${item}» in «${text.trim()}»`);
      }
    }
  }
  return holders;
}

// The paths that the page of B may ask besides its own address /t/<B>/, each with its
// reason (decisions/0109, О19). Measured on the correct server in both pairs, from the
// open of B's address to B's result: the page, its questionnaire and its result under
// /t/<B>/, and twelve files of the page under /assets/. The browser's own request of
// /favicon.ico is not among them: it comes once per start, with the first load of the
// profile, the page of A.
const SHARED_PATHS = [
  {
    path: /^\/assets\/[^/]+$/u,
    reason:
      "a file of the page (README: /assets/<name>), the same for every tenant",
  },
];

// Every request of the page of B (its network records from the open of its address)
// went to the address of B or to a shared path, none under the address of A, and was
// answered on the page. The answer is the control that the records hold the request
// itself: a worker of the page makes its requests outside the records of the page, and
// the request of its script is recorded with no answer (measured: GET /assets/<name>
// of type Script, no status); on the correct page every record has its answer.
function assertRequestsOfB(records, origin, a, b, what) {
  assert.ok(
    records.some(
      (record) =>
        record.type === "Document" &&
        new URL(record.url).pathname === `/t/${b}/`,
    ),
    `${what}: no open of the address of B in the records`,
  );
  for (const record of records) {
    const url = new URL(record.url);
    const asked = `${record.method} ${url.pathname}${url.search}`;
    assert.equal(
      url.origin,
      origin,
      `${what}: B's page asked another server: ${record.url}`,
    );
    assert.ok(
      url.pathname !== `/t/${a}` && !url.pathname.startsWith(`/t/${a}/`),
      `${what}: B's page asked under the address of A: ${asked}`,
    );
    assert.ok(
      url.pathname.startsWith(`/t/${b}/`) ||
        SHARED_PATHS.some((shared) => shared.path.test(url.pathname)),
      `${what}: B's page asked outside its address and the shared paths: ${asked}`,
    );
    assert.notEqual(
      record.status,
      null,
      `${what}: B's page got no answer to ${asked} (a request handed to a worker, or one still on its way)`,
    );
  }
}

// answerAll for the pass of B, with the page of B read on every question screen
// (decisions/0109, О19): `look(question)` runs when the question is on the screen and,
// for an answered one, again after the answer, before the press that leaves it.
async function answerAllLooking(page, questionnaire, set, look, what) {
  const byTitle = byTitleOf(questionnaire, what);
  for (let step = 0; step < 40; step += 1) {
    const question = await questionOnScreen(page, byTitle, what);
    await look(question);
    if (Object.hasOwn(set, question.id)) {
      await answer(page, question, set[question.id]);
      await look(question);
      await page.click('form [data-part="next"]');
    } else {
      assert.equal(
        question.required,
        false,
        `${what}: the set has no answer to the required question ${question.id}`,
      );
      await page.click('[data-action="skip"]');
    }
    if ((await screenAfter(page, question, what)) === "result") return;
  }
  assert.fail(`${what}: no result screen after 40 questions`);
}

// A GET with node:http, the path sent exactly as written (Chrome and fetch would
// turn /t/%2e%2e/ into /). -> { status, body (bytes), sentPath }.
function rawGet(port, rawPath) {
  return new Promise((resolve, reject) => {
    const request = http.request(
      { host: "127.0.0.1", port, path: rawPath, method: "GET", agent: false },
      (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("error", reject);
        response.on("end", () =>
          resolve({
            status: response.statusCode,
            body: Buffer.concat(chunks),
            sentPath: request.path,
          }),
        );
      },
    );
    request.on("error", reject);
    request.end();
  });
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

// A line of a stack: it starts with blanks and "at ". Not \s, which also takes a
// newline and so crosses lines.
function hasStack(text) {
  return /^[ \t]+at /mu.test(text);
}

// ---------------------------------------------------------------- criterion 1

test("matrix", LIMIT, async () => {
  const tenantName = readJson(`${OLD_TENANTS}/uchet-pro.json`).name;
  await withStand(pickerStand(OLD_TENANTS), async (stand) => {
    const questionnaires = {};
    for (const lang of LANGS) {
      questionnaires[lang] = await getJson(
        stand.origin,
        `/t/uchet-pro/api/questionnaire?lang=${lang}`,
      );
    }
    await withBrowser(async (browser) => {
      browser.expectOncePerStart(FAVICON);
      const page = await browser.newPage();
      let count = 0;
      const seen = new Set();
      const backgrounds = { light: new Set(), dark: new Set() };
      for (const lang of LANGS) {
        const q = questionnaires[lang];
        for (const scheme of SCHEMES) {
          for (const [width, height] of WINDOWS) {
            const what = `${lang} ${scheme} ${width}x${height}`;
            count += 1;
            seen.add(what);
            await page.setViewport(width, height);
            await page.setColorScheme(scheme);
            await page.goto(`${stand.origin}/t/uchet-pro/?lang=${lang}`);
            await waitForCard(page, what);
            const card = await page.evaluate(`(() => ({
              lang: document.documentElement.lang,
              h1: [...document.querySelectorAll("h1")].map((h) => h.textContent),
              intro: ${textOf('[data-part="intro"]')},
              dark: matchMedia("(prefers-color-scheme: dark)").matches,
              background: getComputedStyle(document.body).backgroundColor,
            }))()`);
            assert.equal(card.lang, lang, `${what}: html lang`);
            assert.deepEqual(card.h1, [q.name], `${what}: the h1 is the name`);
            assert.equal(
              card.h1[0],
              tenantName[lang],
              `${what}: the tenant file`,
            );
            assert.equal(card.intro, q.intro, `${what}: the intro`);
            assert.equal(card.dark, scheme === "dark", `${what}: the scheme`);
            backgrounds[scheme].add(card.background);
            const cardOverflow = await page.horizontalOverflow();
            assert.equal(
              cardOverflow.overflowing,
              false,
              `${what}: the card is wider than the window`,
            );
            assert.equal(cardOverflow.innerWidth, width, what);
            // inside the window: horizontally where it stands, and wholly once scrolled to
            const button = await page.evaluate(`(() => {
              const start = ${query('[data-action="start"]')};
              const before = start.getBoundingClientRect();
              start.scrollIntoView({ block: "nearest", inline: "nearest" });
              const after = start.getBoundingClientRect();
              return {
                left: before.left,
                right: before.right,
                scrolled: [after.left, after.top, after.right, after.bottom],
                width: innerWidth,
                height: innerHeight,
              };
            })()`);
            assert.ok(button.left >= 0, `${what}: start left ${button.left}`);
            assert.ok(
              button.right <= button.width,
              `${what}: start right ${button.right}`,
            );
            const [left, top, right, bottom] = button.scrolled;
            assert.ok(
              left >= 0 &&
                top >= 0 &&
                right <= button.width &&
                bottom <= button.height,
              `${what}: the start button scrolled into view is not inside the window: ${button.scrolled}`,
            );
            await page.click('[data-action="start"]');
            await page.waitFor(
              `${query('[data-screen="question"]')} !== null`,
              {
                description: `${what}: the first question`,
              },
            );
            const question = await page.evaluate(`(() => ({
              screens: document.querySelectorAll('[data-screen="question"]').length,
              title: ${textOf("#q-title")},
            }))()`);
            assert.equal(
              question.screens,
              1,
              `${what}: one question on the screen`,
            );
            assert.equal(
              question.title,
              q.questions[0].title,
              `${what}: the first question`,
            );
            const questionOverflow = await page.horizontalOverflow();
            assert.equal(
              questionOverflow.overflowing,
              false,
              `${what}: the question is wider than the window`,
            );
          }
        }
      }
      // the control that the loops ran the whole table: 18 different combinations
      assert.equal(count, 18);
      assert.equal(seen.size, 18);
      // each scheme has one look in every window and language, and the two differ
      assert.equal(
        backgrounds.light.size,
        1,
        [...backgrounds.light].join("; "),
      );
      assert.equal(backgrounds.dark.size, 1, [...backgrounds.dark].join("; "));
      assert.notEqual([...backgrounds.light][0], [...backgrounds.dark][0]);
    });
  });
});

// ---------------------------------------------------------------- criterion 2

test("pass", LIMIT, async () => {
  const sets = readJson("src/picker/demo-answers/uchet-pro.json");
  const plan = [
    ["ru", "leader", [1470, 784], "light"],
    ["ru", "close", [390, 844], "dark"],
    ["ru", "none", [320, 568], "light"],
    ["kk", "leader", [320, 568], "dark"],
    ["en", "leader", [1470, 784], "dark"],
  ];
  await withStand(pickerStand(OLD_TENANTS), async (stand) => {
    await withBrowser(async (browser) => {
      browser.expectOncePerStart(FAVICON);
      const covered = [];
      const russian = [];
      for (const [lang, setName, [width, height], scheme] of plan) {
        const what = `${lang} ${setName} ${width}x${height} ${scheme}`;
        const set = sets[setName];
        const q = await getJson(
          stand.origin,
          `/t/uchet-pro/api/questionnaire?lang=${lang}`,
        );
        const page = await browser.newPage();
        await page.setViewport(width, height);
        await page.setColorScheme(scheme);
        await startFresh(page, `${stand.origin}/t/uchet-pro/?lang=${lang}`);
        await waitForCard(page, what);
        await page.click('[data-action="start"]');
        const met = await answerAll(page, q, set, what);
        for (const id of Object.keys(set)) {
          assert.ok(
            met.includes(id),
            `${what}: the question ${id} was not met`,
          );
        }
        const after = await page.evaluate(`(() => {
          const focus = document.activeElement;
          return {
            result: ${query('[data-screen="result"]')} !== null,
            focusOnHeading:
              focus.matches("h1, h2, h3") &&
              focus.closest('[data-screen="result"]') !== null,
            width: innerWidth,
            dark: matchMedia("(prefers-color-scheme: dark)").matches,
            lang: document.documentElement.lang,
          };
        })()`);
        assert.equal(after.result, true, `${what}: the result screen`);
        assert.equal(
          after.focusOnHeading,
          true,
          `${what}: the focus is on its heading`,
        );
        const post = await resultRecord(page, what);
        const url = new URL(post.url);
        assert.equal(url.pathname, "/t/uchet-pro/api/result", what);
        assert.equal(
          url.searchParams.get("lang"),
          lang,
          `${what}: the language asked`,
        );
        // every answer of the set and nothing else (no answer of a hidden question)
        assert.deepEqual(
          JSON.parse(post.requestBody),
          { answers: set },
          `${what}: the body`,
        );
        const direct = await directPost(stand.origin, "uchet-pro", lang, set);
        assert.equal(direct.status, 200, what);
        assert.equal(
          post.body,
          direct.text,
          `${what}: the answer the page got`,
        );
        if (lang === "ru") russian.push(post.body);
        // what the pass covered, as the page reports it
        covered.push({
          width: after.width,
          scheme: after.dark ? "dark" : "light",
          lang: after.lang,
          set: setName,
        });
        await page.close();
      }
      // the control that a wrong answer would be noticed: three different answers
      assert.equal(
        new Set(russian).size,
        3,
        "the three Russian answers differ",
      );
      const values = (key) => new Set(covered.map((row) => row[key]));
      assert.deepEqual(values("width"), new Set([1470, 390, 320]));
      assert.deepEqual(values("scheme"), new Set(["light", "dark"]));
      assert.deepEqual(values("lang"), new Set(["ru", "kk", "en"]));
      assert.deepEqual(values("set"), new Set(["leader", "close", "none"]));

      // the hidden pass: an answer to a question that became hidden is neither sent
      // nor kept. The expected answers are computed from the set, not read from the page.
      const leader = sets.leader;
      const expected = { ...leader, problems: ["no-reports"] };
      delete expected.recount;
      const q = await getJson(
        stand.origin,
        "/t/uchet-pro/api/questionnaire?lang=ru",
      );
      const questionOf = (id) => q.questions.find((one) => one.id === id);
      const page = await browser.newPage();
      await page.setViewport(1470, 784);
      await page.setColorScheme("light");
      await startFresh(page, `${stand.origin}/t/uchet-pro/?lang=ru`);
      await waitForCard(page, "hidden");
      await page.click('[data-action="start"]');
      const at = (id) => atQuestion(page, questionOf(id), "hidden");
      const next = () => page.click('form [data-part="next"]');
      const back = () => page.click('[data-action="back"]');
      for (const id of [
        "business",
        "items",
        "places",
        "tools",
        "problems",
        "staff",
        "recount",
      ]) {
        await at(id);
        await answer(page, questionOf(id), leader[id]);
        await next();
      }
      await at("migrate");
      for (const id of ["recount", "staff", "problems"]) {
        await back();
        await at(id);
      }
      // slow-count off and no-reports on: the question recount is hidden now
      await answer(page, questionOf("problems"), ["slow-count", "no-reports"]);
      await next();
      await at("staff");
      await next();
      await at("migrate");
      for (const id of ["migrate", "budget", "goal"]) {
        await at(id);
        await answer(page, questionOf(id), leader[id]);
        await next();
      }
      await page.waitFor(`${query('[data-screen="result"]')} !== null`, {
        description: "hidden: the result screen",
      });
      const post = await resultRecord(page, "hidden");
      assert.deepEqual(
        JSON.parse(post.requestBody),
        { answers: expected },
        "hidden: the body",
      );
      const stored = JSON.parse(
        await page.evaluate(
          `localStorage.getItem(${JSON.stringify(TENANT_KEY)})`,
        ),
      );
      assert.deepEqual(stored.answers, expected, "hidden: the stored answers");
      const direct = await directPost(
        stand.origin,
        "uchet-pro",
        "ru",
        expected,
      );
      assert.equal(post.body, direct.text, "hidden: the answer the page got");
      await page.close();
    });
  });
});

// ---------------------------------------------------------------- criterion 3

test("themes", LIMIT, async () => {
  // the controls of the formula, before the page is touched
  assert.equal(contrast([0, 0, 0], [255, 255, 255]), 21);
  assert.equal(contrast([118, 118, 118], [118, 118, 118]), 1);
  assert.ok(
    contrast([0x76, 0x76, 0x76], [255, 255, 255]) >= 4.5,
    "#767676 on white",
  );
  assert.ok(
    contrast([0x77, 0x77, 0x77], [255, 255, 255]) < 4.5,
    "#777777 on white",
  );
  await withStand(pickerStand(OLD_TENANTS), async (stand) => {
    await withBrowser(async (browser) => {
      browser.expectOncePerStart(FAVICON);
      const page = await browser.newPage();
      const looks = {};
      for (const scheme of SCHEMES) {
        await page.setColorScheme(scheme);
        await page.goto(`${stand.origin}/t/uchet-pro/?lang=ru`);
        await waitForCard(page, scheme);
        const look = await page.evaluate(CARD_COLOURS);
        assert.equal(look.dark, scheme === "dark", `${scheme}: the scheme`);
        for (const part of ["body", "intro"]) {
          const ratio = contrast(look[part].text, look[part].back);
          assert.ok(
            ratio >= 4.5,
            `${scheme}: the contrast of ${part} is ${ratio.toFixed(2)} (${look[part].text} on ${look[part].back})`,
          );
        }
        looks[scheme] = look;
      }
      assert.notEqual(looks.light.bodyBackground, looks.dark.bodyBackground);
    });
  });
});

// ---------------------------------------------------------------- criterion 4

test("keyboard", LIMIT, async () => {
  await withStand(pickerStand(OLD_TENANTS), async (stand) => {
    const q = await getJson(
      stand.origin,
      "/t/uchet-pro/api/questionnaire?lang=ru",
    );
    const [first, second] = q.questions;
    const firstOption = first.options[0].id;
    await withBrowser(async (browser) => {
      browser.expectOncePerStart(FAVICON);
      const page = await browser.newPage();
      await page.goto(`${stand.origin}/t/uchet-pro/?lang=ru`);
      await waitForCard(page, "keyboard");
      // the control: before the first Tab the body has the focus and shows no ring
      const before = await page.evaluate(FOCUS_INFO);
      assert.equal(before.tag, "BODY");
      assert.equal(before.ring, false, "the ring rule sees a ring on the body");
      assert.notEqual(before.live, "", "the live region is empty on the card");
      // from here on: keys only (Tab, Shift+Tab, Enter, Space), no mouse
      const start = await tabTo(page, "start", 6, "the card");
      assert.equal(start.screen, "card");
      await page.press("Enter");
      await atQuestion(page, first, "keyboard");
      const onFirst = await page.evaluate(FOCUS_INFO);
      assertMoved(onFirst, "question", "start");
      assert.match(onFirst.progress, /^Вопрос 1 из \d+$/u);

      // answer with Space: chosen and kept at once
      await tabTo(page, "radio", 1, "question 1");
      await page.press("Space");
      assert.deepEqual(await page.evaluate(CHECKED_VALUES), [firstOption]);
      const kept = JSON.parse(
        await page.evaluate(
          `localStorage.getItem(${JSON.stringify(TENANT_KEY)})`,
        ),
      );
      assert.equal(kept.current, first.id);
      assert.deepEqual(kept.answers, { [first.id]: firstOption });
      await tabTo(page, "next", 1, "question 1");
      await page.press("Tab", { shift: true });
      const backAgain = await page.evaluate(FOCUS_INFO);
      assert.equal(
        backAgain.type,
        "radio",
        "Shift+Tab goes back to the answer",
      );
      assert.equal(backAgain.ring, true, "no visible ring on the radio button");

      // forward with next, back with back
      await tabTo(page, "next", 1, "question 1");
      await page.press("Enter");
      await atQuestion(page, second, "keyboard");
      const onSecond = await page.evaluate(FOCUS_INFO);
      assertMoved(onSecond, "question", "next");
      assert.match(onSecond.progress, /^Вопрос 2 из \d+$/u);
      await tabTo(page, "number", 1, "question 2");
      await tabTo(page, "back", 1, "question 2");
      await page.press("Enter");
      await atQuestion(page, first, "keyboard");
      const backOnFirst = await page.evaluate(FOCUS_INFO);
      assertMoved(backOnFirst, "question", "back");
      assert.match(backOnFirst.progress, /^Вопрос 1 из \d+$/u);
      assert.deepEqual(
        await page.evaluate(CHECKED_VALUES),
        [firstOption],
        "the answer is kept after back",
      );

      // «Начать заново» is on the card only when something is saved: one reload
      // (a call of the protocol, not an input event), then keys again
      await page.reload();
      await page.waitFor(
        `${query('[data-screen="card"] [data-action="restart"]')} !== null`,
        { description: "the card with continue and restart" },
      );
      const restart = await tabTo(page, "restart", 6, "the card after reload");
      assert.equal(restart.screen, "card");
      assert.notEqual(restart.live, "", "the live region is empty on the card");
      await page.press("Enter");
      await atQuestion(page, first, "keyboard");
      const afresh = await page.evaluate(FOCUS_INFO);
      assertMoved(afresh, "question", "restart");
      assert.match(afresh.progress, /^Вопрос 1 из \d+$/u);
      assert.deepEqual(await page.evaluate(CHECKED_VALUES), []);
      assert.equal(await page.evaluate("localStorage.length"), 0);
    });
  });
});

// ---------------------------------------------------------------- criterion 5

test("storage", LIMIT, async () => {
  // the controls of the rule, before the page is touched
  assert.equal(noContactData("contact 87010000000"), false);
  assert.equal(noContactData("a@b.example"), false);
  assert.equal(
    noContactData('{"lang":"ru","current":"tools","answers":{"items":120}}'),
    true,
  );
  const leader = readJson("src/picker/demo-answers/uchet-pro.json").leader;
  await withStand(pickerStand(OLD_TENANTS), async (stand) => {
    const q = await getJson(
      stand.origin,
      "/t/uchet-pro/api/questionnaire?lang=ru",
    );
    const [first, second, third, fourth] = q.questions;
    const three = [first, second, third];
    await withBrowser(async (browser) => {
      browser.expectOncePerStart(FAVICON);
      const page = await browser.newPage();
      await page.goto(`${stand.origin}/t/uchet-pro/?lang=ru`);
      await waitForCard(page, "storage");
      await page.click('[data-action="start"]');
      for (const question of three) {
        await atQuestion(page, question, "storage");
        await answer(page, question, leader[question.id]);
        await page.click('form [data-part="next"]');
      }
      await atQuestion(page, fourth, "storage");

      // after a reload the card offers to continue, and continue opens question 4
      await page.reload();
      await page.waitFor(
        `${query('[data-screen="card"] [data-action="continue"]')} !== null`,
        { description: "the card with «Продолжить»" },
      );
      assert.equal(
        await page.evaluate(`${query('[data-action="start"]')}`),
        null,
      );
      await page.click('[data-action="continue"]');
      await atQuestion(page, fourth, "storage");
      assert.match(
        await page.evaluate(textOf('[data-part="progress-text"]')),
        /^Вопрос 4 из \d+$/u,
      );

      // the storage of the origin: exactly the one key of the tenant
      const state = await page.evaluate(STORAGE_STATE);
      assert.deepEqual(state.keys, [TENANT_KEY]);
      assert.equal(state.session, 0, "sessionStorage holds something");
      assert.equal(state.cookie, "", "the page set a cookie");
      const text = state.values[TENANT_KEY];
      const value = JSON.parse(text);
      assert.deepEqual(Object.keys(value).sort(), [
        "answers",
        "current",
        "format",
        "lang",
        "version",
      ]);
      assert.equal(value.format, 1);
      assert.match(value.version, /^[0-9a-f]{64}$/u);
      assert.equal(value.version, q.version);
      assert.equal(value.lang, "ru");
      assert.equal(value.current, fourth.id);
      const expected = Object.fromEntries(
        three.map((question) => [question.id, leader[question.id]]),
      );
      assert.deepEqual(value.answers, expected);
      // every stored answer is an answer of the questionnaire
      for (const [id, stored] of Object.entries(value.answers)) {
        const question = q.questions.find((one) => one.id === id);
        assert.ok(question, `the stored id ${id} is not a question`);
        if (question.type === "number") {
          assert.ok(
            Number.isInteger(stored) &&
              stored >= question.min &&
              stored <= question.max,
            `the stored number of ${id}: ${stored}`,
          );
        } else {
          const options = question.options.map((option) => option.id);
          const ids = question.type === "single" ? [stored] : stored;
          for (const one of ids) {
            assert.ok(options.includes(one), `the stored answer ${id}: ${one}`);
          }
        }
      }
      // no free text and no contact data: in what the visitor can influence, and no
      // "@" anywhere in the value
      const visitorParts = JSON.stringify({
        lang: value.lang,
        current: value.current,
        answers: value.answers,
      });
      assert.equal(noContactData(visitorParts), true, visitorParts);
      assert.ok(!text.includes("@"), "the stored value holds an @");

      // back three times: the three answers are still chosen
      for (const question of [third, second, first]) {
        await page.click('[data-action="back"]');
        await atQuestion(page, question, "storage back");
        if (question.type === "number") {
          assert.equal(
            await page.evaluate(`${query("#q-input")}.value`),
            String(leader[question.id]),
            question.id,
          );
        } else {
          assert.deepEqual(
            await page.evaluate(CHECKED_VALUES),
            question.type === "single"
              ? [leader[question.id]]
              : leader[question.id],
            question.id,
          );
        }
      }

      // «Начать заново» removes the key of the tenant and nothing else
      await page.evaluate("localStorage.setItem('decoy', '1')");
      await page.reload();
      await page.waitFor(
        `${query('[data-screen="card"] [data-action="restart"]')} !== null`,
        { description: "the card with «Начать заново»" },
      );
      await page.click('[data-action="restart"]');
      await atQuestion(page, first, "storage restart");
      assert.deepEqual((await page.evaluate(STORAGE_STATE)).keys, ["decoy"]);
    });
  });
});

// ---------------------------------------------------------------- criterion 6

// The pairs A, B of criterion 6, each with what was measured on the correct server:
// the one-word texts of A that stand inside a Russian text of B's tenant file
// (decisions/0109, О17 as corrected after the second pass of the gate), and the texts
// and solution names of A that stand inside a text of the page on a screen of B's
// pass, by screen, with that text (О19): only «человек», inside the option «Есть
// отдельный человек» of svet-marketing's file on the screen of its question team. No
// fixed text of the page holds one. «Средний» (inside a rule text) and «Обучение»
// (inside an item of a solution) are shown by no screen.
const PAIRS = [
  [
    OLD_TENANTS,
    "src/picker/demo-answers",
    "uchet-pro",
    "svet-marketing",
    ["человек", "Средний"],
    ["question 11 (team): «человек» in «Есть отдельный человек»"],
  ],
  [
    NEW_TENANTS,
    "src/picker/demo-answers-v3",
    "agency",
    "stock",
    ["Обучение"],
    [],
  ],
];

test("isolation", LIMIT, async () => {
  for (const [
    tenantsDir,
    answersDir,
    a,
    b,
    measuredCommon,
    measuredOnScreens,
  ] of PAIRS) {
    const what = `${a} then ${b}`;
    const setOfA = readJson(`${answersDir}/${a}.json`).leader;
    const setOfB = readJson(`${answersDir}/${b}.json`).leader;
    const namesOfA = solutionNames(readJson(`${tenantsDir}/${a}.json`));
    // the oracle of B's texts is B's tenant file, outside the server under test
    // (decisions/0109, О17): the list of A's texts is built against it, and B's
    // answers must hold its strings only (the addendum after the second pass)
    const bytesOfB = fs.readFileSync(path.join(TOOLS, tenantsDir, `${b}.json`));
    const fileOfB = JSON.parse(bytesOfB.toString("utf8"));
    assert.equal(fileOfB.id, b, `${what}: the tenant file of B`);
    const composed = composedFields(bytesOfB);
    // B's file is also the oracle of the keys of B's answers and of the texts of B
    // that each screen of B's page shows (decisions/0109, О19)
    const keysOfB = new Set(placedKeys(fileOfB, "").map(([, key]) => key));
    const textsOfB = visitorTexts(fileOfB, russianOf, b);
    await withStand(pickerStand(tenantsDir), async (stand) => {
      const qa = await getJson(
        stand.origin,
        `/t/${a}/api/questionnaire?lang=ru`,
      );
      // B's questionnaire as served is used for B's own pass only
      const qb = await getJson(
        stand.origin,
        `/t/${b}/api/questionnaire?lang=ru`,
      );
      const textsOfA = exclusiveStrings(qa, fileOfB);
      // the control that the check can see anything
      assert.ok(
        textsOfA.length >= 10,
        `${what}: ${textsOfA.length} texts of A`,
      );
      assert.ok(namesOfA.length >= 1, `${what}: no solution name of A`);
      // the exception of the one-word rule holds the measured words only
      const common = commonWords(textsOfA, fileOfB);
      assert.deepEqual(
        common,
        measuredCommon,
        `${what}: the one-word texts of A inside the texts of B`,
      );
      const itemsOfA = [...textsOfA, ...namesOfA];
      await withBrowser(async (browser) => {
        browser.expectOncePerStart(FAVICON);
        const page = await browser.newPage();
        await page.goto(`${stand.origin}/t/${a}/?lang=ru`);
        await waitForCard(page, `${what}: the card of A`);
        await page.click('[data-action="start"]');
        await answerAll(page, qa, setOfA, `${what}: the pass of A`);

        // the page of B in the same browser
        page.clearNetwork();
        await page.goto(`${stand.origin}/t/${b}/?lang=ru`);
        await waitForCard(page, `${what}: the card of B`);
        const card = await page.evaluate(`(() => ({
          text: document.body.textContent,
          continues: ${query('[data-action="continue"]')} !== null,
        }))()`);
        for (const text of [...textsOfA, ...namesOfA]) {
          assert.ok(
            !card.text.includes(text),
            `${what}: the card of B shows «${text}»`,
          );
        }
        assert.equal(card.continues, false, `${what}: B offers to continue`);
        assert.deepEqual(
          (await page.evaluate(STORAGE_STATE)).keys,
          [`sai-picker:${a}`],
          `${what}: the storage`,
        );
        const asked = page
          .network()
          .filter(
            (record) =>
              new URL(record.url).pathname === `/t/${b}/api/questionnaire`,
          );
        assert.equal(asked.length, 1, `${what}: B asked for its questionnaire`);
        const questionnaireOfB = await page.responseBody(asked[0].requestId);
        assertNothingOf(
          questionnaireOfB,
          textsOfA,
          common,
          namesOfA,
          `${what}: the questionnaire answer of B`,
        );
        assertTextsOfFile(
          questionnaireOfB,
          fileOfB,
          `${what}: the questionnaire answer of B`,
        );
        assertOwnStrings(
          questionnaireOfB,
          fileOfB,
          composed.questionnaire,
          `${what}: the questionnaire answer of B`,
        );
        assertOwnKeys(
          questionnaireOfB,
          keysOfB,
          ANSWER_FIELDS.questionnaire,
          `${what}: the questionnaire answer of B`,
        );

        // every screen of B's own pass shows nothing of A (decisions/0109, О19): the
        // card, each question, the result. A text of A inside a text of B's file on
        // the screen is compared with whole texts, and stands only inside such texts;
        // where it stands on the page is the measured fact, pinned below.
        const onScreens = [];
        const look = async (kind, label, prefix) => {
          const where = `${what}: the screen of ${label} of B`;
          const shown = await page.evaluate(SCREEN_TEXTS);
          assert.deepEqual(shown.screens, [kind], `${where}: the screens`);
          const holders = assertScreenNothingOf(
            shown,
            itemsOfA,
            shownTexts(textsOfB, prefix),
            where,
          );
          for (const holder of holders) {
            const entry = `${label}: ${holder}`;
            if (!onScreens.includes(entry)) onScreens.push(entry);
          }
        };
        await look("card", "the card", "intro");

        // B's own pass: its result holds nothing of A, and B's own strings only
        await page.click('[data-action="start"]');
        await answerAllLooking(
          page,
          qb,
          setOfB,
          (question) => {
            const place = `question ${qb.questions.indexOf(question) + 1} (${question.id})`;
            return look("question", place, `${place}: `);
          },
          `${what}: the pass of B`,
        );
        await look("result", "the result", null);
        const post = await resultRecord(page, `${what}: the result of B`);
        assertNothingOf(
          post.body,
          textsOfA,
          common,
          namesOfA,
          `${what}: the result of B`,
        );
        assertOwnStrings(
          post.body,
          fileOfB,
          composed.result,
          `${what}: the result of B`,
        );
        assertOwnKeys(
          post.body,
          keysOfB,
          ANSWER_FIELDS.result,
          `${what}: the result of B`,
        );
        // the screen of the result again, after its answer was read
        await look("result", "the result", null);
        assert.deepEqual(
          onScreens,
          measuredOnScreens,
          `${what}: the texts of A inside the texts of B on its screens`,
        );
        // every request of B's page, from the open of its address to its result
        assertRequestsOfB(page.network(), stand.origin, a, b, what);
        // the records hold the requests of the page itself: a dedicated or a shared
        // worker shows there as its script with no answer (above), a service worker
        // only as a registration of the origin, and its requests nowhere (measured: a
        // service worker of B's page asked A's questionnaire unseen); the correct page
        // registers none
        assert.deepEqual(
          await page.evaluate(
            "navigator.serviceWorker.getRegistrations().then((all) => all.map((one) => one.scope))",
          ),
          [],
          `${what}: a service worker of the origin of B's page`,
        );
        // what B's page got under its own page address and under the shared paths
        // holds no text and no solution name of A (measured on the correct server: the
        // page and its files hold none), so a shared path cannot bring A's data to
        // B's page; B's two answers under /t/<B>/api/ have their own checks above
        for (const record of page.network()) {
          const { pathname } = new URL(record.url);
          if (pathname.startsWith(`/t/${b}/api/`)) continue;
          const body = await page.responseBody(record.requestId);
          for (const item of itemsOfA) {
            assert.ok(
              !body.includes(item),
              `${what}: B's page got «${item}» of A with ${pathname}`,
            );
          }
        }
      });
      // the answers of A sent to B: an error answer, not a result of A
      const foreign = await directPost(stand.origin, b, "ru", setOfA);
      assert.equal(foreign.status, 400, `${what}: ${foreign.text}`);
      assert.equal(typeof JSON.parse(foreign.text).error, "string", what);
      for (const name of namesOfA) {
        assert.ok(
          !foreign.text.includes(name),
          `${what}: «${name}» in the error`,
        );
      }
      // an answer at the address of B, so the rule of B's answers holds for it too
      assertNothingOf(
        foreign.text,
        textsOfA,
        common,
        namesOfA,
        `${what}: the answer of B to the answers of A`,
      );
      assertOwnKeys(
        foreign.text,
        new Set(),
        ANSWER_FIELDS.error,
        `${what}: the answer of B to the answers of A`,
      );
      // the server writes its failures to stderr: no stack there, and code 0
      assert.deepEqual(await stand.stop(), { code: 0, signal: null }, what);
      assert.equal(
        hasStack(stand.stderr()),
        false,
        `${what}: ${stand.stderr()}`,
      );
    });
  }
});

// ---------------------------------------------------------------- criterion 7

test("not found", LIMIT, async () => {
  // the controls of the stack expression, before the page is touched
  assert.equal(hasStack("Error: boom\n    at fake (file.js:1:1)\n"), true);
  assert.equal(hasStack("we arrive at the end"), false);
  assert.equal(hasStack("note\n\nat start"), false);
  const paths = ["/t/net-takogo/", "/t/UCHET-PRO/", "/t/uchet-pro/%00", "/"];
  await withStand(pickerStand(OLD_TENANTS), async (stand) => {
    await withBrowser(async (browser) => {
      browser.expectOncePerStart(FAVICON);
      for (const urlPath of paths) {
        browser.expect({
          kind: "browser-log",
          text: NOT_FOUND_404,
          path: urlPath,
        });
      }
      const page = await browser.newPage();
      const hashes = [];
      for (const urlPath of paths) {
        const href = `${stand.origin}${urlPath}`;
        const loaded = await page.goto(href);
        assert.equal(loaded.status, 404, urlPath);
        const text = await page.evaluate("document.body.innerText");
        assert.ok(text.includes(NOT_FOUND_LINE), `${urlPath}: ${text}`);
        const documents = page
          .network()
          .filter(
            (record) => record.type === "Document" && record.url === href,
          );
        assert.ok(documents.length >= 1, `${urlPath}: no document record`);
        const body = await page.responseBody(documents.at(-1).requestId);
        hashes.push(sha256(Buffer.from(body, "utf8")));
      }
      // the fifth address goes as written: Chrome would send / instead
      const raw = await rawGet(stand.port, "/t/%2e%2e/");
      assert.equal(raw.sentPath, "/t/%2e%2e/");
      assert.equal(raw.status, 404);
      assert.ok(raw.body.toString("utf8").includes(NOT_FOUND_LINE));
      hashes.push(sha256(raw.body));
      assert.equal(
        new Set(hashes).size,
        1,
        `the five bodies differ: ${hashes}`,
      );

      // afterwards the card still opens; its page is not the 404 body (the control)
      const cardHref = `${stand.origin}/t/uchet-pro/`;
      await page.goto(cardHref);
      await waitForCard(page, "after the bad addresses");
      const cardDocument = page
        .network()
        .filter(
          (record) => record.type === "Document" && record.url === cardHref,
        )
        .at(-1);
      const cardBody = await page.responseBody(cardDocument.requestId);
      assert.notEqual(sha256(Buffer.from(cardBody, "utf8")), hashes[0]);
    });
    assert.deepEqual(await stand.stop(), { code: 0, signal: null });
    assert.equal(hasStack(stand.stderr()), false, stand.stderr());
  });
});

// ---------------------------------------------------------------- criterion 8

// The block of a lost net under the question, once the page has dealt with the
// request number `failures`: its text, its button and where the focus is.
async function lostNetBlock(page, failures, what) {
  await until(
    () =>
      page
        .network()
        .filter((record) => record.method === "POST" && record.failed !== null)
        .length === failures,
    10000,
    `${what}: failed request ${failures}`,
  );
  return page.waitFor(
    `(() => {
      const block = ${query('[data-kind="result"]')};
      const button = block && block.querySelector('[data-action="retry"]');
      if (!button) return null;
      return {
        text: block.textContent,
        button: button.textContent,
        focused: document.activeElement === button,
        screen: block.closest("[data-screen]").getAttribute("data-screen"),
      };
    })()`,
    { description: `${what}: the block of the lost net` },
  );
}

test("no connection", LIMIT, async () => {
  const leader = readJson("src/picker/demo-answers/uchet-pro.json").leader;
  await withStand(pickerStand(OLD_TENANTS), async (stand) => {
    const q = await getJson(
      stand.origin,
      "/t/uchet-pro/api/questionnaire?lang=ru",
    );
    await withBrowser(async (browser) => {
      browser.expectOncePerStart(FAVICON);
      browser.expect(REFUSED);
      const page = await browser.newPage();
      await page.goto(`${stand.origin}/t/uchet-pro/?lang=ru`);
      await waitForCard(page, "no connection");
      await page.click('[data-action="start"]');
      await answerUpToLast(page, q, leader, "no connection");
      const before = await page.evaluate(
        `localStorage.getItem(${JSON.stringify(TENANT_KEY)})`,
      );
      assert.equal(typeof before, "string", "the answers are saved");

      // the server goes away; then «Показать результат»
      assert.deepEqual(await stand.stop(), { code: 0, signal: null });
      await page.click('form [data-part="next"]');
      for (const failures of [1, 2]) {
        const block = await lostNetBlock(page, failures, `press ${failures}`);
        assert.ok(
          block.text.includes(LOST_NET),
          `press ${failures}: ${block.text}`,
        );
        assert.equal(block.button, RETRY, `press ${failures}`);
        assert.equal(block.focused, true, `press ${failures}: the focus`);
        assert.equal(block.screen, "question", `press ${failures}`);
        assert.equal(
          await page.evaluate(
            `localStorage.getItem(${JSON.stringify(TENANT_KEY)})`,
          ),
          before,
          `press ${failures}: the saved answers changed`,
        );
        // «Повторить» with the server still down
        if (failures === 1) {
          await page.click('[data-kind="result"] [data-action="retry"]');
        }
      }
      const refused = () =>
        browser
          .consoleEntries()
          .filter(
            (entry) =>
              entry.kind === REFUSED.kind && entry.text === REFUSED.text,
          );
      await until(() => refused().length >= 2, 5000, "the two console lines");
      assert.equal(refused().length, 2, "one console line per failed request");
    });
  });
});

// ---------------------------------------------------------------- criterion 9

test("v3", LIMIT, async () => {
  await withStand(pickerStand(NEW_TENANTS), async (stand) => {
    await withBrowser(async (browser) => {
      browser.expectOncePerStart(FAVICON);
      for (const id of ["agency", "stock"]) {
        const leader = readJson(`src/picker/demo-answers-v3/${id}.json`).leader;
        const q = await getJson(
          stand.origin,
          `/t/${id}/api/questionnaire?lang=ru`,
        );
        for (const [width, height, scheme] of [
          [1470, 784, "light"],
          [390, 844, "dark"],
        ]) {
          const what = `${id} ${width}x${height} ${scheme}`;
          const page = await browser.newPage();
          await page.setViewport(width, height);
          await page.setColorScheme(scheme);
          await startFresh(page, `${stand.origin}/t/${id}/?lang=ru`);
          await waitForCard(page, what);
          assert.deepEqual(
            await page.evaluate(
              `[...document.querySelectorAll('[data-screen="card"] h1')].map((h) => h.textContent)`,
            ),
            [q.name],
            `${what}: the card`,
          );
          await page.click('[data-action="start"]');
          await answerAll(page, q, leader, what);
          const post = await resultRecord(page, what);
          assert.deepEqual(
            JSON.parse(post.requestBody),
            { answers: leader },
            what,
          );
          const direct = await directPost(stand.origin, id, "ru", leader);
          assert.equal(direct.status, 200, what);
          assert.equal(
            post.body,
            direct.text,
            `${what}: the answer the page got`,
          );
          await page.close();
        }
      }
    });
  });
});
