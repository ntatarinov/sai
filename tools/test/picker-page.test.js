// QP-1 ... QP-11: the questionnaire page of the picker site, criterion by criterion (design
// REQ-057, 16 and 17.1). The real modules of tools/src/picker/public/ run in Node on a
// model of the document (picker-page-dom.js) with a network, a storage, an address and a
// history that the test controls. A real browser is not here: the layout, the colors, the
// real focus order and the sizes are the steps of the acceptance run in Chrome (design 18).
// The expected values come from the requirement, from the tenant files and from the table
// of the texts in picker-page-helpers.js, never from the modules of the page.
import assert from "node:assert/strict";
import { test } from "node:test";
import { inspect } from "node:util";
import { makeRng } from "./picker-helpers.js";
import {
  LANGS,
  PAGE_TEXTS,
  RESULT_OK,
  SERVER_TEXTS,
  LANGUAGE_LABELS,
  SWITCHER_LABEL,
  choose,
  customSite,
  demoSite,
  expectedProgress,
  legacySite,
  loadPage,
  number,
  pageText,
  raw,
  same,
  s1Site,
  settle,
  single,
  typeNumber,
  walkForward,
} from "./picker-page-helpers.js";

const UP = "uchet-pro";
const SM = "svet-marketing";
const up = demoSite(UP);
const sm = demoSite(SM);
const KEY = (id) => `sai-picker:${id}`;

// ---- the data of a tenant that the tests read as the oracle

// The text of a field of the tenant file in a language (a /2 file holds { ru, kk, en }).
const say = (value, lang) => (typeof value === "string" ? value : value[lang]);
const questionOf = (site, id) => site.plain.questions.find((q) => q.id === id);
const titleOf = (site, id, lang = "ru") =>
  say(questionOf(site, id).title, lang);
const plainCount = (site) =>
  site.plain.questions.filter((q) => !Object.hasOwn(q, "show_if")).length;

// A value of the storage as the page writes it.
function savedValue(site, fields = {}) {
  return JSON.stringify({
    format: 1,
    version: site.version,
    lang: "ru",
    current: null,
    answers: {},
    ...fields,
  });
}

// The full set of answers of the path "leader" of the tenant (the demo answers of
// REQ-054) is not used here: each test names the answers it needs.
async function openCard(t, options = {}) {
  return loadPage(t, options);
}

// Starts the questionnaire from the card.
async function begin(t, options = {}) {
  const page = await loadPage(t, options);
  await page.tap("start");
  return page;
}

// The answers of uchet-pro up to the question `stop` (not answered), by the path of a
// retail shop that keeps its goods on paper.
const UP_PATH = [
  ["business", "retail"],
  ["items", 120],
  ["places", "one-place"],
  ["tools", ["paper"]],
  ["problems", ["losses"]],
  ["staff", 3],
];

async function goThrough(page, path, stop) {
  for (const [id, value] of path) {
    if (id === stop) return;
    await page.answer(value);
    await page.tap("next");
  }
}

const requestCount = (page) => page.net.requests.length;

// ---------------------------------------------------------------------- QP-0

test("QP-0a: the model of the document holds the page to its surface - innerHTML, insertAdjacentHTML, a parent node, a body, document.write, or a style other than the width are errors, so a page that reaches for them turns its test red", async (t) => {
  const page = await loadPage(t, { start: false });
  const document = globalThis.document;
  const node = document.createElement("div");
  const refused = [
    () => {
      node.innerHTML = "<b>x</b>";
    },
    () => node.insertAdjacentHTML("beforeend", "x"),
    () => node.parentNode,
    () => node.children,
    () => node.classList,
    () => node.dataset,
    () => document.body,
    () => document.write("x"),
    () => document.querySelector("div"),
    () => {
      document.cookie = "a=b";
    },
    () => {
      node.id = "x";
    },
  ];
  for (const [i, attempt] of refused.entries())
    assert.throws(attempt, TypeError, `refused #${i}`);
  // what is allowed works
  node.setAttribute("data-part", "x");
  node.append("a", document.createElement("span"));
  assert.equal(node.getAttribute("data-part"), "x");
  assert.equal(node.textContent, "a");
  node.textContent = "b";
  assert.equal(node.textContent, "b");
  assert.equal(document.title, "Sai");
  assert.equal(page.doc.html.attr("lang"), "ru");
});

test("QP-0b: the model acts as a browser where the tests rely on it - a control inside a shut fieldset gets no click, no change and no focus; a number field gives value '' and badInput for a text that is not a number; removing the node that has the focus moves the focus to the body; a radio button turns the others of its name off", async (t) => {
  const page = await loadPage(t, { start: false });
  const document = globalThis.document;
  const make = (tag, attrs = {}) => {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    return el;
  };
  const form = make("form");
  const set = make("fieldset");
  const a = make("input", { type: "radio", name: "g", value: "a" });
  const b = make("input", { type: "radio", name: "g", value: "b" });
  const number = make("input", { type: "number" });
  const button = make("button", { type: "button" });
  set.append(a, b, number);
  form.append(set, button);
  page.app.append(form);
  const [ra, rb, rn, rbutton] = [a, b, number, button];
  let changes = 0;
  const wanted = [ra, rb];
  for (const node of wanted)
    node.addEventListener("change", () => (changes += 1));
  // radio group
  assert.equal(choose(ra), true);
  assert.equal(choose(rb), true);
  assert.deepEqual([ra.checked, rb.checked], [false, true]);
  assert.equal(changes, 2);
  assert.equal(choose(rb), true, "already on: no new event");
  assert.equal(changes, 2);
  // the shut fieldset
  set.setAttribute("disabled", "");
  assert.equal(choose(ra), false);
  assert.equal(typeNumber(rn, "5"), false);
  assert.equal(changes, 2);
  assert.equal(rn.value, "");
  rbutton.focus({ preventScroll: true });
  same(page.active, raw(rbutton));
  ra.focus({ preventScroll: true });
  same(
    page.active,
    raw(rbutton),
    "a control in a shut fieldset takes no focus",
  );
  set.removeAttribute("disabled");
  rn.focus({ preventScroll: true });
  same(page.active, raw(rn));
  set.setAttribute("disabled", "");
  same(page.active, page.doc.body, "the focus leaves a field that is shut");
  set.removeAttribute("disabled");
  // the number field
  const cases = [
    ["", "", false],
    ["12", "12", false],
    ["007", "007", false],
    ["-0", "-0", false],
    ["1e3", "1e3", false],
    ["2.5", "2.5", false],
    [".5", ".5", false],
    ["+5", "", true],
    ["abc", "", true],
    ["5.", "", true],
    ["--1", "", true],
  ];
  for (const [text, value, bad] of cases) {
    typeNumber(rn, text);
    assert.equal(rn.value, value, text);
    assert.equal(rn.validity.badInput, bad, text);
  }
  // the focus goes to the body when its node leaves the page
  rbutton.focus({ preventScroll: true });
  assert.equal(page.active.tag, "button");
  page.app.replaceChildren();
  same(page.active, page.doc.body);
});

test("QP-0c: a node of the model prints short - a failed check with a node, a text, the document or the node as the page sees it as an operand shows the tag, the id and the classes and never the tree, in util.inspect and in the message of assert, so one failure cannot print the document and take gigabytes", async (t) => {
  const page = await loadPage(t);
  const document = globalThis.document;
  const div = document.createElement("div");
  assert.equal(inspect(raw(div)), "<div>");
  div.setAttribute("id", "x");
  assert.equal(inspect(raw(div)), "<div#x>");
  div.setAttribute("class", "a  b");
  assert.equal(inspect(raw(div)), "<div#x.a.b>");
  assert.equal(inspect([page.app, page.doc]), "[ <main#app>, <document> ]");
  // the page holds a whole screen: the tree below main is large, and none of it may
  // reach a message
  assert.ok(page.app.all("*").length > 10, "a tree that is large enough");
  const text = page.app
    .all("*")
    .flatMap((n) => n.children)
    .find((child) => child.tag === undefined);
  assert.equal(typeof text?.data, "string", "a text node was found");
  const operands = [
    ["a node", page.app],
    ["a node as the page sees it", document.getElementById("app")],
    ["the document", page.doc],
    ["a text", text],
  ];
  const messageOf = (check) => {
    try {
      check();
    } catch (error) {
      return String(error.message);
    }
    return null;
  };
  for (const [label, operand] of operands) {
    for (const [name, check] of [
      ["equal", () => assert.equal(operand, null)],
      ["strictEqual", () => assert.strictEqual(null, operand)],
      ["deepEqual", () => assert.deepEqual(operand, { tag: "other" })],
      ["notEqual", () => assert.notEqual(operand, operand)],
    ]) {
      const message = messageOf(check);
      assert.notEqual(message, null, `${label} ${name}: the check fails`);
      assert.ok(
        message.length < 600,
        `${label} ${name}: a message of ${message.length} signs`,
      );
      assert.ok(
        !message.includes(page.text),
        `${label} ${name}: the text of the page is in the message`,
      );
      // no field that leads to the rest of the tree is printed
      const reach =
        /\b(doc|parent|children|listeners|proxy|html|head|body|log|focusCalls|activeElement|api):/u.exec(
          message,
        );
      assert.equal(
        reach === null ? "none" : reach[1],
        "none",
        `${label} ${name}: a field that leads to the tree is printed`,
      );
    }
  }
  assert.ok(messageOf(() => assert.equal(page.app, null)).includes("main"));
});

// ---------------------------------------------------------------------- QP-1

test("QP-1a: the first page of a tenant without saved answers - the name, the introduction, what you get, the call, the number of questions from the questionnaire, and one button 'Take the survey'; no 'Continue', no 'Start over', no notice", async (t) => {
  const page = await openCard(t);
  assert.equal(page.screen, "card");
  const min = plainCount(up);
  const max = up.plain.questions.length;
  assert.deepEqual([min, max], [8, 12]);
  assert.deepEqual(page.panel.textNodes(), [
    say(up.plain.name, "ru"),
    LANGUAGE_LABELS.ru,
    LANGUAGE_LABELS.kk,
    LANGUAGE_LABELS.en,
    say(up.plain.intro, "ru"),
    "В конце вы увидите, что вы получите: что входит, чем это поможет и что делать дальше.",
    "Ответьте на вопросы, и сайт подберёт вам решение.",
    `Вопросов: от ${min} до ${max}`,
    "Пройти опрос",
  ]);
  assert.equal(page.all('[data-action="start"]').length, 1);
  assert.equal(page.all('[data-action="continue"]').length, 0);
  assert.equal(page.all('[data-action="restart"]').length, 0);
  assert.equal(page.all('[data-part="notice"]').length, 0);
  // the other tenant: its own numbers
  const other = await loadPage(t, { path: `/t/${SM}/` });
  assert.equal(
    other.part("count").text,
    `Вопросов: от ${plainCount(sm)} до ${sm.plain.questions.length}`,
  );
  assert.deepEqual(page.strays(), {
    console: [],
    rejections: [],
    dialogs: [],
    misuse: [],
    storageMisuse: [],
  });
});

test("QP-1b: saved answers - 'Continue' and 'Start over' instead of 'Take the survey'; 'Start over' removes exactly the key of the tenant, opens the first question with no answer chosen and touches no other key; the next answer is written alone", async (t) => {
  const foreign = savedValue(sm, {
    current: "place",
    answers: { place: "cafe" },
  });
  const page = await loadPage(t, {
    storage: {
      initial: {
        [KEY(UP)]: savedValue(up, {
          current: "places",
          answers: { business: "retail", items: 120 },
        }),
        [KEY(SM)]: foreign,
        foreign: "keep me",
      },
    },
  });
  assert.equal(page.all('[data-action="start"]').length, 0);
  assert.equal(page.action("continue").text, "Продолжить");
  assert.equal(page.action("restart").text, "Начать заново");
  const writesBefore = page.storage.sets().length;
  await page.tap("restart");
  assert.deepEqual(page.storage.removes(), [
    { op: "removeItem", key: KEY(UP) },
  ]);
  assert.equal(page.storage.sets().length, writesBefore);
  assert.equal(page.storage.data.has(KEY(UP)), false);
  assert.equal(page.storage.data.get(KEY(SM)), foreign);
  assert.equal(page.storage.data.get("foreign"), "keep me");
  assert.equal(page.screen, "question");
  assert.equal(page.qTitle, titleOf(up, "business"));
  assert.deepEqual(
    page.inputs.map((i) => i.checked),
    [false, false, false],
  );
  await page.answer("wholesale");
  assert.deepEqual(page.stored(UP).answers, { business: "wholesale" });
  assert.equal(page.storage.data.get(KEY(SM)), foreign);

  // design rule C3, the other place of the button: on the temporary screen of the result
  // (rework after the test-design check, F1; mutant R06 hands 'Start over' of this
  // screen the function of 'Take the survey', which leaves the saved answers in place)
  const toResult = async () => {
    const result = await begin(t, {
      storage: { initial: { [KEY(SM)]: foreign, foreign: "keep me" } },
    });
    await walkForward(result, up, makeRng(57011), { omitRate: 0 });
    assert.equal(result.screen, "result");
    assert.ok(result.stored(UP), "the answers are saved at the result");
    return result;
  };
  const end = await toResult();
  const requestsBefore = requestCount(end);
  const postsBefore = end.net.posts.length;
  const setsBefore = end.storage.sets().length;
  const removesBefore = end.storage.removes().length;
  assert.equal(removesBefore, 0);
  await end.tap("restart");
  assert.deepEqual(end.storage.removes().slice(removesBefore), [
    { op: "removeItem", key: KEY(UP) },
  ]);
  assert.equal(end.storage.removes().length, 1, "exactly one removeItem");
  assert.equal(
    end.storage.sets().length,
    setsBefore,
    "the button writes nothing",
  );
  assert.equal(end.storage.data.has(KEY(UP)), false, "the key is gone");
  assert.equal(end.storage.data.get(KEY(SM)), foreign);
  assert.equal(end.storage.data.get("foreign"), "keep me");
  assert.equal(
    requestCount(end),
    requestsBefore,
    "the button sends no request",
  );
  assert.equal(end.net.posts.length, postsBefore);
  assert.equal(end.screen, "question");
  assert.equal(end.qTitle, titleOf(up, "business"));
  assert.deepEqual(
    end.inputs.map((i) => i.checked),
    [false, false, false],
  );
  await end.answer("wholesale");
  assert.equal(end.storage.sets().length, setsBefore + 1, "one write");
  assert.deepEqual(end.stored(UP).answers, { business: "wholesale" });
  // a reload after 'Start over' (the key is gone): the card with 'Take the survey'
  const again = await toResult();
  await again.tap("restart");
  await again.reload();
  assert.equal(again.screen, "card");
  assert.equal(again.action("start").text, "Пройти опрос");
  assert.equal(again.all('[data-action="continue"]').length, 0);
  assert.equal(again.all('[data-action="restart"]').length, 0);
  assert.equal(again.all('[data-part="notice"]').length, 0);
  assert.equal(again.storage.data.has(KEY(UP)), false);
});

test("QP-1c: a stored value that holds only the language (or the language and the first question, or a place that is not a visible question) is not 'saved': the card offers 'Take the survey', and the language is used", async (t) => {
  const values = [
    savedValue(up, { lang: "kk" }),
    savedValue(up, { lang: "kk", current: "business" }),
    // a place that is no question of the file, and a place that is a question hidden by
    // the answers (the answers are none): nothing to continue from
    savedValue(up, { lang: "kk", current: "zzz" }),
    savedValue(up, { lang: "kk", current: "x".repeat(64) }),
  ];
  for (const value of values) {
    const page = await loadPage(t, {
      storage: { initial: { [KEY(UP)]: value } },
    });
    assert.equal(page.screen, "card", value);
    assert.equal(page.all('[data-action="continue"]').length, 0, value);
    assert.equal(page.all('[data-action="restart"]').length, 0, value);
    assert.equal(page.action("start").text, "Сауалнамадан өту", value);
    assert.equal(page.lang, "kk");
    assert.equal(page.storage.data.get(KEY(UP)), value, "the value stays");
  }
  const s1 = s1Site();
  const hidden = savedValue(s1, { current: "b" });
  const h = await loadPage(t, {
    sites: [s1],
    path: "/t/file-s1/",
    storage: { initial: { [KEY("file-s1")]: hidden } },
  });
  assert.equal(h.screen, "card");
  assert.equal(h.all('[data-action="continue"]').length, 0, "b is hidden");
  assert.equal(h.all('[data-action="restart"]').length, 0);
  assert.equal(h.action("start").text, "Пройти опрос");
  assert.equal(h.storage.data.get(KEY("file-s1")), hidden);
});

test("QP-1d: 'Take the survey' writes nothing to the storage and asks the server for nothing; the first question opens", async (t) => {
  const page = await openCard(t);
  const requests = requestCount(page);
  const logLength = page.storage.log.length;
  await page.tap("start");
  assert.equal(page.screen, "question");
  assert.equal(page.qTitle, titleOf(up, "business"));
  assert.equal(requestCount(page), requests);
  assert.equal(page.storage.sets().length, 0);
  assert.equal(page.storage.log.length, logLength);
  assert.equal(page.all('[data-action="back"]').length, 0);
});

test("QP-1e: the number of questions - 'Questions: A' when all the questions are asked, 'from A to B' when some depend on answers; in three languages", async (t) => {
  const three = customSite({
    id: "three-plain",
    languages: ["ru", "kk", "en"],
    questions: [
      single("a", "A", ["x", "y"]),
      single("b", "B", ["x", "y"]),
      single("c", "C", ["x", "y"]),
    ],
  });
  for (const lang of LANGS) {
    const page = await loadPage(t, {
      sites: [three],
      search: `?lang=${lang}`,
    });
    assert.equal(
      page.part("count").text,
      pageText("card_count_same", lang, { count: 3 }),
    );
  }
  assert.equal(pageText("card_count_same", "ru", { count: 3 }), "Вопросов: 3");
  const ranged = await loadPage(t, { search: "?lang=en" });
  assert.equal(ranged.part("count").text, "Questions: from 8 to 12");
  const kk = await loadPage(t, { search: "?lang=kk", path: `/t/${SM}/` });
  assert.equal(kk.part("count").text, "Сұрақтар: 7 бастап 11 дейін");
});

// ---------------------------------------------------------------------- QP-2

test("QP-2a: a question of one choice - one question on the screen, radio buttons with one name, the id of the option as the value, a wrapping label with the text of the option", async (t) => {
  const page = await begin(t);
  assert.equal(page.all('[data-part="q-title"]').length, 1);
  assert.equal(page.all("h2").length, 1);
  assert.equal(page.all("form").length, 1);
  const question = questionOf(up, "business");
  const inputs = page.inputs;
  assert.equal(inputs.length, question.options.length);
  assert.deepEqual(
    inputs.map((i) => i.value),
    question.options.map((o) => o.id),
  );
  for (const [i, input] of inputs.entries()) {
    assert.equal(input.attr("type"), "radio");
    assert.equal(input.attr("name"), "answer");
    assert.equal(input.parent.tag, "label");
    assert.ok(
      input.parent.textNodes().includes(say(question.options[i].label, "ru")),
    );
  }
  assert.equal(
    page.must("fieldset").attr("aria-labelledby"),
    page.must("h2").id,
  );
  assert.equal(page.must("h2").id, "q-title");
  // one choice at a time
  await page.choose(inputs[0]);
  await page.choose(inputs[1]);
  assert.deepEqual(
    inputs.map((i) => i.checked),
    [false, true, false],
  );
});

test("QP-2b: a question of several choices - check boxes; several can be on; the answer is written in the order of the options; the last one off clears the answer", async (t) => {
  const page = await begin(t);
  await goThrough(page, UP_PATH, "tools");
  assert.equal(page.qTitle, titleOf(up, "tools"));
  const boxes = page.inputs;
  assert.deepEqual(
    boxes.map((i) => [i.attr("type"), i.value]),
    questionOf(up, "tools").options.map((o) => ["checkbox", o.id]),
  );
  const byValue = (value) => boxes.find((i) => i.value === value);
  await page.choose(byValue("sheets"));
  await page.choose(byValue("paper"));
  assert.deepEqual(page.stored(UP).answers.tools, ["paper", "sheets"]);
  assert.deepEqual(page.chosen(), ["paper", "sheets"]);
  await page.choose(byValue("sheets"));
  assert.deepEqual(page.stored(UP).answers.tools, ["paper"]);
  await page.choose(byValue("paper"));
  assert.equal(Object.hasOwn(page.stored(UP).answers, "tools"), false);
  assert.deepEqual(page.chosen(), []);
});

test("QP-2c: a question of a number - a number field with the limits of the questionnaire, the unit in its label, the hint with the limits, and the hint tied to the field; without a unit the label is the title of the question, hidden by the page", async (t) => {
  const page = await begin(t);
  await goThrough(page, UP_PATH, "items");
  const question = questionOf(up, "items");
  const input = page.must("input");
  assert.equal(input.attr("type"), "number");
  assert.equal(input.attr("min"), String(question.min));
  assert.equal(input.attr("max"), String(question.max));
  assert.equal(input.attr("inputmode"), "numeric");
  assert.equal(input.attr("step"), "1");
  const label = page.must('label[for="q-input"]');
  assert.equal(input.id, "q-input");
  assert.equal(label.text, say(question.unit, "ru"));
  assert.equal(label.attr("data-hidden"), null);
  assert.equal(
    page.part("q-hint").text,
    `От ${question.min} до ${question.max}`,
  );
  assert.ok(input.attr("aria-describedby").split(" ").includes("q-hint"));
  // without a unit
  const bare = customSite({
    id: "no-unit",
    questions: [number("n", "How many tables", 1, 40)],
  });
  const page2 = await begin(t, { sites: [bare] });
  const label2 = page2.must('label[for="q-input"]');
  assert.equal(label2.text, "How many tables");
  assert.equal(label2.attr("data-hidden"), "true");
  assert.equal(page2.part("q-hint").text, "От 1 до 40");
});

test("QP-2d: 'Back' - not on the first visible question; on the next one it leads to the previous visible question (over a hidden one) with the answer chosen before; the answer of the question left is kept", async (t) => {
  const s1 = s1Site();
  const page = await begin(t, { sites: [s1] });
  assert.equal(page.all('[data-action="back"]').length, 0);
  await page.answer("p");
  await page.tap("next");
  assert.equal(page.qTitle, "Question b");
  assert.ok(page.action("back"));
  await page.answer("p");
  await page.tap("next");
  assert.equal(page.qTitle, "Question d"); // c is hidden: a = p
  await page.answer("q");
  await page.tap("back");
  assert.equal(page.qTitle, "Question b"); // not c
  assert.equal(page.chosen(), "p");
  await page.tap("back");
  assert.equal(page.qTitle, "Question a");
  assert.equal(page.chosen(), "p");
  assert.equal(page.all('[data-action="back"]').length, 0);
  await page.tap("next");
  await page.tap("next");
  assert.equal(page.qTitle, "Question d");
  assert.equal(page.chosen(), "q", "the answer of d was kept when going back");
  assert.deepEqual(page.stored("file-s1").answers, { a: "p", b: "p", d: "q" });
  // a move with no new answer writes the place (design 5.2, Q2, Q3, Q5, E1): after
  // 'Next', after 'Back' and after 'Back' from the screen of the result, the stored
  // place is the new question, and a new load with 'Continue' opens it
  const moves = await begin(t, { sites: [s1] });
  await moves.answer("p");
  await moves.tap("next");
  assert.equal(moves.qTitle, "Question b");
  assert.equal(moves.stored("file-s1").current, "b", "'Next' writes the place");
  await moves.reload();
  await moves.tap("continue");
  assert.equal(moves.qTitle, "Question b", "'Continue' after 'Next'");
  assert.equal(moves.chosen(), null);
  await moves.answer("p");
  await moves.tap("next");
  assert.equal(moves.qTitle, "Question d");
  assert.equal(moves.stored("file-s1").current, "d");
  await moves.tap("back");
  assert.equal(moves.qTitle, "Question b");
  assert.equal(moves.stored("file-s1").current, "b", "'Back' writes the place");
  assert.deepEqual(moves.stored("file-s1").answers, { a: "p", b: "p" });
  await moves.reload();
  await moves.tap("continue");
  assert.equal(moves.qTitle, "Question b", "'Continue' after 'Back'");
  assert.equal(moves.chosen(), "p");
  await moves.tap("back");
  assert.equal(moves.stored("file-s1").current, "a");
  await moves.tap("next");
  assert.equal(
    moves.stored("file-s1").current,
    "b",
    "'Next' over answers given",
  );
  const done = await begin(t, { sites: [s1] });
  for (const [id, value] of [
    ["a", "q"],
    ["c", "p"],
    ["d", "q"],
  ]) {
    assert.equal(done.currentQuestion(s1).id, id);
    await done.answer(value);
    await done.tap("next");
  }
  await done.answer("p");
  await done.tap("show-result");
  assert.equal(done.screen, "result");
  assert.equal(done.stored("file-s1").current, "f");
  const writes = done.storage.sets().length;
  // another tab (or an older load) put another place in the storage: 'Back' from the
  // result writes the place of the question it opens, so the value is the last question
  // again (design 5.2, E1) - a value that the write log alone does not show
  done.storage.data.set(
    KEY("file-s1"),
    JSON.stringify({ ...done.stored("file-s1"), current: "a" }),
  );
  assert.equal(done.stored("file-s1").current, "a");
  await done.tap("edit");
  assert.equal(done.qTitle, "Question f");
  assert.equal(
    done.storage.sets().length,
    writes + 1,
    "'Back' from the result writes the place",
  );
  assert.equal(
    done.stored("file-s1").current,
    "f",
    "'Back' from the result stores the question it opens",
  );
  await done.reload();
  await done.tap("continue");
  assert.equal(done.qTitle, "Question f");
  assert.equal(done.chosen(), "p");
});

test("QP-2e: 'Skip' - only on a question that is not required; it clears the answer and goes on; on the last optional question it asks for the result without that answer; 'Next' on an optional question with no answer goes on too", async (t) => {
  const page = await begin(t);
  const seen = [];
  const rng = makeRng(57010);
  for (let guard = 0; guard < 20 && page.screen === "question"; guard += 1) {
    const question = page.currentQuestion(up);
    seen.push([question.id, page.all('[data-action="skip"]').length]);
    await page.answer(
      question.type === "single"
        ? rng.pick(question.options).id
        : question.type === "multiple"
          ? [question.options[0].id]
          : question.min + 1,
    );
    await page.tap(page.action("show-result") ? "show-result" : "next");
  }
  for (const [id, skips] of seen)
    assert.equal(skips, questionOf(up, id).required ? 0 : 1, id);
  assert.ok(
    seen.some(([, skips]) => skips === 1),
    "an optional question was met",
  );
  const optional = customSite({
    id: "optional-last",
    questions: [
      single("first", "First", ["x", "y"]),
      single("last", "Last", ["x", "y"], { required: false }),
    ],
  });
  const p = await begin(t, { sites: [optional] });
  await p.answer("x");
  await p.tap("next");
  assert.equal(p.qTitle, "Last");
  await p.answer("y");
  await p.tap("skip");
  assert.equal(p.screen, "result");
  assert.equal(p.net.posts.length, 1);
  assert.deepEqual(p.net.posts[0].body, { answers: { first: "x" } });
  assert.deepEqual(p.stored("optional-last").answers, { first: "x" });
  // "Next" with no answer on an optional question goes on, and sends no answer for it
  const q = await begin(t, { sites: [optional] });
  await q.answer("x");
  await q.tap("next");
  await q.tap("show-result");
  assert.equal(q.screen, "result");
  assert.deepEqual(q.net.posts[0].body, { answers: { first: "x" } });
  // skip clears an answer that was given and goes back to find it empty
  const r = await begin(t, { sites: [optional] });
  await r.answer("x");
  await r.tap("next");
  await r.answer("y");
  assert.deepEqual(r.stored("optional-last").answers, {
    first: "x",
    last: "y",
  });
  await r.tap("back");
  await r.tap("next");
  assert.equal(r.chosen(), "y");
  await r.tap("skip");
  await r.tap("edit");
  assert.equal(r.chosen(), null, "the skipped answer is gone");
  assert.deepEqual(r.stored("optional-last").answers, { first: "x" });
  // 'Skip' on the last optional question clears the field at once: when the net is
  // refused the question stays on the screen, and it shows no answer; 'Try again'
  // sends the body without it
  const failed = await begin(t, { sites: [optional] });
  await failed.answer("x");
  await failed.tap("next");
  await failed.answer("y");
  failed.net.on((req) => req.method === "POST", "network");
  await failed.tap("skip");
  assert.equal(failed.screen, "question");
  assert.equal(failed.qTitle, "Last");
  assert.equal(failed.part("net").attr("data-kind"), "result");
  assert.equal(failed.chosen(), null, "the skipped choice is not shown");
  assert.equal(
    failed.all("input").filter((input) => input.checked).length,
    0,
    "no option is on",
  );
  assert.deepEqual(failed.stored("optional-last").answers, { first: "x" });
  await failed.tap("retry");
  assert.equal(failed.screen, "result");
  assert.deepEqual(failed.net.posts.at(-1).body, { answers: { first: "x" } });
  const numeric = customSite({
    id: "optional-number-last",
    questions: [
      single("first", "First", ["x", "y"]),
      number("n", "How many", 1, 10, { required: false }),
    ],
  });
  const n = await begin(t, { sites: [numeric] });
  await n.answer("x");
  await n.tap("next");
  await n.type(n.must("input"), "5");
  assert.deepEqual(n.stored("optional-number-last").answers, {
    first: "x",
    n: 5,
  });
  n.net.on((req) => req.method === "POST", "network");
  await n.tap("skip");
  assert.equal(n.screen, "question");
  assert.equal(n.part("net").attr("data-kind"), "result");
  assert.equal(n.must("input").value, "", "the skipped number is not shown");
  assert.deepEqual(n.stored("optional-number-last").answers, { first: "x" });
  await n.tap("retry");
  assert.equal(n.screen, "result");
  assert.deepEqual(n.net.posts.at(-1).body, { answers: { first: "x" } });
  // a number outside the limits is refused with a message, then 'Skip' with the net
  // refused: the field, the message and the mark of the field are all gone, the block of
  // the net stands, the storage holds no answer for the question
  const late = await begin(t, { sites: [numeric] });
  await late.answer("x");
  await late.tap("next");
  await late.type(late.must("input"), "11");
  await late.tap("show-result");
  assert.equal(late.part("q-error").text, "Введите целое число от 1 до 10.");
  assert.equal(late.must("input").attr("aria-invalid"), "true");
  assert.ok(late.must("input").attr("aria-describedby").includes("q-error"));
  const posts = late.net.posts.length;
  late.net.on((req) => req.method === "POST", "network");
  await late.tap("skip");
  assert.equal(late.net.posts.length, posts + 1, "one request went");
  assert.equal(late.screen, "question");
  assert.equal(late.must("input").value, "", "the field is empty");
  assert.equal(late.part("q-error").text, "", "the message is gone");
  assert.equal(late.must("input").attr("aria-invalid"), null);
  assert.ok(
    !late.must("input").attr("aria-describedby").split(" ").includes("q-error"),
    "the field is not described by the message",
  );
  assert.equal(late.part("net").attr("data-kind"), "result");
  assert.deepEqual(late.stored("optional-number-last").answers, { first: "x" });
  assert.deepEqual(late.net.posts.at(-1).body, { answers: { first: "x" } });
  // the skipped text does not come back at a change of the language, nor does the message
  const wide = customSite({
    id: "optional-number-wide",
    languages: ["ru", "kk"],
    questions: [
      single("first", "First", ["x", "y"]),
      number("n", "How many", 1, 10, { required: false }),
    ],
  });
  const w = await begin(t, { sites: [wide] });
  await w.answer("x");
  await w.tap("next");
  await w.type(w.must("input"), "11");
  await w.tap("show-result");
  assert.equal(w.part("q-error").text, "Введите целое число от 1 до 10.");
  w.net.on((req) => req.method === "POST", "network");
  await w.tap("skip");
  assert.equal(w.must("input").value, "");
  await w.click(w.langButton("kk"));
  assert.equal(w.lang, "kk");
  assert.equal(w.qTitle, "How many");
  assert.equal(w.must("input").value, "", "the skipped number stays skipped");
  assert.equal(w.part("q-error").text, "", "no message comes back");
  assert.equal(w.must("input").attr("aria-invalid"), null);
  // a text left outside the limits by 'Skip' does not move to the next number question
  const twice = customSite({
    id: "optional-number-twice",
    questions: [
      number("n1", "First number", 1, 10, { required: false }),
      number("n2", "Second number", 1, 10, { required: false }),
      single("z", "Last", ["x", "y"]),
    ],
  });
  const t2 = await begin(t, { sites: [twice] });
  await t2.type(t2.must("input"), "11");
  assert.equal(t2.must("input").value, "11");
  await t2.tap("skip");
  assert.equal(t2.qTitle, "Second number");
  assert.equal(t2.must("input").value, "", "the next field is empty");
  await t2.tap("skip");
  assert.equal(t2.qTitle, "Last");
  await t2.tap("back");
  assert.equal(t2.must("input").value, "");
  await t2.tap("back");
  assert.equal(t2.must("input").value, "");
  // ... nor does it move to the question before when the visitor goes 'Back' with a
  // text outside the limits in the field: the field shows the answer given there
  const back = await begin(t, { sites: [twice] });
  await back.type(back.must("input"), "5");
  await back.tap("next");
  assert.equal(back.qTitle, "Second number");
  await back.type(back.must("input"), "11");
  assert.equal(back.must("input").value, "11");
  await back.tap("back");
  assert.equal(back.qTitle, "First number");
  assert.equal(back.must("input").value, "5", "the field shows its own answer");
  await back.tap("next");
  assert.equal(back.must("input").value, "", "the second field is empty");
  const bare = await begin(t, { sites: [twice] });
  await bare.tap("next");
  await bare.type(bare.must("input"), "abc");
  await bare.tap("back");
  assert.equal(bare.qTitle, "First number");
  assert.equal(bare.must("input").value, "", "no text of the other field");
});

test("QP-2f: 'Next' with no answer to a required question - the screen and the position stay, the message of the page stands in an element that was in the tree before (role alert, aria-live assertive), the focus is on the first field; nothing is written and nothing is asked; a change of the answer clears the message", async (t) => {
  const page = await begin(t);
  const slot = page.part("q-error");
  assert.ok(slot);
  assert.equal(slot.text, "");
  assert.equal(slot.attr("role"), "alert");
  assert.equal(slot.attr("aria-live"), "assertive");
  const requests = requestCount(page);
  const logLength = page.storage.log.length;
  const snapshot = page.storage.snapshot();
  await page.tap("next");
  assert.equal(page.qTitle, titleOf(up, "business"));
  same(page.part("q-error"), slot, "the same element");
  assert.equal(slot.text, "Ответьте на этот вопрос, чтобы продолжить.");
  assert.equal(slot.attr("role"), "alert");
  same(page.active, page.inputs[0]);
  assert.equal(requestCount(page), requests);
  assert.equal(page.storage.log.length, logLength);
  assert.deepEqual(page.storage.snapshot(), snapshot);
  assert.ok(
    page
      .must("fieldset")
      .attr("aria-describedby")
      .split(" ")
      .includes("q-error"),
  );
  await page.answer("retail");
  assert.equal(slot.text, "");
});

test("QP-2g: a number - an empty field of a required question asks for an answer; a text that is not a whole number or is outside the limits gives the message with the limits (a required and an optional question alike); '007' is 7; aria-invalid is set and taken away; a failed 'Next' changes nothing", async (t) => {
  const page = await begin(t);
  await goThrough(page, UP_PATH, "items");
  const input = () => page.must("input");
  const message = () => page.part("q-error").text;
  const range = "Введите целое число от 1 до 100000.";
  const refusals = [
    ["", "Ответьте на этот вопрос, чтобы продолжить."],
    ["abc", range],
    ["1e3", range],
    ["2.5", range],
    ["+5", range],
    ["0", range],
    ["-3", range],
    ["100001", range],
    ["99999999999999999999", range],
  ];
  for (const [text, expected] of refusals) {
    await page.type(input(), text);
    const snapshot = page.storage.snapshot();
    const requests = requestCount(page);
    await page.tap("next");
    assert.equal(page.qTitle, titleOf(up, "items"), JSON.stringify(text));
    assert.equal(message(), expected, JSON.stringify(text));
    if (text !== "") assert.equal(input().attr("aria-invalid"), "true", text);
    same(page.active, input(), text);
    assert.deepEqual(page.storage.snapshot(), snapshot, `${text}: storage`);
    assert.equal(requestCount(page), requests, `${text}: requests`);
  }
  // typing a right number clears the message and the mark
  await page.type(input(), "7");
  assert.equal(message(), "");
  assert.equal(input().attr("aria-invalid"), null);
  // '007' is the whole number 7
  await page.type(input(), "007");
  await page.tap("next");
  assert.equal(page.qTitle, titleOf(up, "places"));
  assert.equal(page.stored(UP).answers.items, 7);
  // an optional number question with a wrong text is refused too; skip clears the field
  const site = customSite({
    id: "optional-number",
    questions: [
      number("n", "How many", 1, 10, { required: false }),
      single("z", "Last", ["x", "y"]),
    ],
  });
  const p = await begin(t, { sites: [site] });
  // a number outside the limits and a text that is not a number: both are refused with
  // the message, nothing is written and nothing is asked
  for (const text of ["11", "abc", "0"]) {
    await p.type(p.must("input"), text);
    const snapshot = p.storage.snapshot();
    const requests = requestCount(p);
    await p.tap("next");
    assert.equal(p.qTitle, "How many", text);
    assert.equal(
      p.part("q-error").text,
      "Введите целое число от 1 до 10.",
      text,
    );
    assert.equal(p.must("input").attr("aria-invalid"), "true", text);
    assert.deepEqual(p.storage.snapshot(), snapshot, `${text}: storage`);
    assert.equal(requestCount(p), requests, `${text}: requests`);
  }
  await p.tap("skip");
  assert.equal(p.qTitle, "Last");
  assert.deepEqual(p.stored("optional-number").answers, {});
  await p.tap("back");
  assert.equal(p.must("input").value, "");
  await p.tap("next");
  assert.equal(p.qTitle, "Last", "empty and optional goes on");
  // zero and a negative sign are whole numbers in a range that holds them
  const signed = customSite({
    id: "signed",
    questions: [number("n", "Signed", -5, 5), single("z", "Last", ["x", "y"])],
  });
  const s = await begin(t, { sites: [signed] });
  await s.type(s.must("input"), "-0");
  await s.tap("next");
  assert.equal(s.qTitle, "Last");
  assert.equal(s.stored("signed").answers.n, 0);
  await s.tap("back");
  await s.type(s.must("input"), "-4");
  assert.equal(s.stored("signed").answers.n, -4);
});

test("QP-2h: on the last visible question the main button is 'Show the result', and it is counted again at every change of the answer: an answer that opens a question below brings 'Next' back", async (t) => {
  const site = customSite({
    id: "last-follows",
    questions: [
      single("a", "A", ["x", "y"]),
      single("b", "B", ["x", "y"], {
        show_if: [{ question: "a", any_of: ["x"] }],
      }),
    ],
  });
  const page = await begin(t, { sites: [site] });
  const main = () => page.must('[data-part="next"]');
  assert.equal(main().attr("type"), "submit");
  // nothing answered: b is not visible yet, so a is the last visible question
  assert.equal(main().attr("data-action"), "show-result");
  await page.answer("x");
  assert.equal(main().attr("data-action"), "next");
  assert.equal(main().text, "Далее");
  await page.answer("y");
  assert.equal(main().attr("data-action"), "show-result");
  assert.equal(main().text, "Показать результат");
  await page.answer("x");
  assert.equal(main().attr("data-action"), "next");
  assert.equal(main().text, "Далее");
  await page.answer("y");
  assert.equal(main().attr("data-action"), "show-result");
  await page.tap("show-result");
  assert.equal(page.screen, "result");
  // the first question of a file of one question is the last at once
  const one = customSite({
    id: "one-only",
    questions: [single("a", "A", ["x", "y"])],
  });
  const p = await begin(t, { sites: [one] });
  assert.equal(p.must('[data-part="next"]').attr("data-action"), "show-result");
});

test("QP-2i: the buttons stand in the order 'Back', 'Skip', 'Next'; the form is sent as 'Next' with the default action prevented; a form sent while the result is asked for does nothing", async (t) => {
  const site = customSite({
    id: "order",
    questions: [
      single("a", "A", ["x", "y"]),
      single("b", "B", ["x", "y"], { required: false }),
    ],
  });
  const page = await begin(t, { sites: [site] });
  await page.answer("x");
  const submit = page.must("form").dispatch("submit");
  await settle();
  assert.equal(submit.defaultPrevented, true);
  assert.equal(page.qTitle, "B");
  assert.deepEqual(
    page.all('[data-part="actions"] button').map((b) => b.attr("data-part")),
    ["back", "skip", "next"],
  );
  // the form is sent while the request of the result is open
  const hold = page.net.hold((r) => r.method === "POST");
  await page.answer("y");
  page.must("form").dispatch("submit");
  await settle();
  assert.equal(page.net.posts.length, 1);
  page.must("form").dispatch("submit");
  await page.tap("show-result");
  assert.equal(page.net.posts.length, 1, "one request");
  hold.respond({
    status: 200,
    body: {
      clear_leader: true,
      recommended: [],
      no_match_text: null,
      hypotheses: [],
    },
  });
  await settle();
  assert.equal(page.screen, "result");
});

test("QP-2j: Enter in the field of a number works as 'Next' - with a right number it goes on, with a wrong one or an empty one of a required question it stays and says why; Enter on a choice of radio buttons likewise", async (t) => {
  const page = await begin(t);
  await goThrough(page, UP_PATH, "items");
  const field = () => page.must("input");
  await page.type(field(), "abc");
  await page.enter(field());
  assert.equal(page.qTitle, titleOf(up, "items"));
  assert.equal(
    page.part("q-error").text,
    "Введите целое число от 1 до 100000.",
  );
  await page.type(field(), "");
  await page.enter(field());
  assert.equal(page.qTitle, titleOf(up, "items"));
  assert.equal(page.part("q-error").text, PAGE_TEXTS.quiz_required[0]);
  await page.type(field(), "75");
  await page.enter(field());
  assert.equal(page.qTitle, titleOf(up, "places"));
  assert.equal(page.stored(UP).answers.items, 75);
  await page.answer("one-place");
  await page.enter(page.inputs[0]);
  assert.equal(page.qTitle, titleOf(up, "tools"));
  assert.equal(page.part("progress-text").text, "Вопрос 4 из 10");
});

// ---------------------------------------------------------------------- QP-3

test("QP-3a: 'Question K of N' and the progress bar - a progressbar with aria-valuemin 0, aria-valuenow K, aria-valuemax N, the same text in aria-valuetext, a name; the fill is K/N per cent with one decimal; the live region gets the text at every move", async (t) => {
  const page = await begin(t);
  const check = (k, n) => {
    const p = page.progress;
    assert.deepEqual([p.k, p.n, p.min], [k, n, "0"]);
    assert.equal(p.text, `Вопрос ${k} из ${n}`);
    assert.equal(p.valuetext, p.text);
    assert.equal(p.label, "Ход опроса");
    assert.equal(p.fill, `${((k / n) * 100).toFixed(1)}%`);
    assert.equal(page.part("bar").attr("role"), "progressbar");
  };
  check(1, 12);
  assert.equal(page.live.text, "Вопрос 1 из 12");
  await page.answer("retail");
  await page.tap("next");
  check(2, 11);
  assert.equal(page.live.text, "Вопрос 2 из 11");
  await page.tap("back");
  check(1, 12);
  assert.equal(page.live.text, "Вопрос 1 из 12");
  assert.equal(page.live.attr("aria-live"), "polite");
  assert.equal(page.live.attr("role"), "status");
});

test("QP-3b: 200 forward paths of answers on each of the two tenants (fixed seed) - N is never bigger than at the step before; at the last question K = N; K and N are those of the rule of the requirement at every step", async (t) => {
  for (const site of [up, sm]) {
    const page = await loadPage(t, { path: `/t/${site.id}/` });
    const rng = makeRng(57001);
    for (let run = 0; run < 200; run += 1) {
      page.storage.data.clear();
      await page.reload();
      await page.tap("start");
      const { steps, given } = await walkForward(page, site, rng);
      assert.ok(steps.length >= 7, `${site.id} #${run}: ${steps.length} steps`);
      const questions = site.body("ru").questions;
      let before = Infinity;
      const answered = {};
      for (const step of steps) {
        assert.ok(step.n <= before, `${site.id} #${run}: N grew at ${step.id}`);
        before = step.n;
        const expected = expectedProgress(questions, answered, step.id);
        assert.deepEqual(
          [step.k, step.n],
          [expected.k, expected.n],
          `${site.id} #${run} ${step.id}`,
        );
        if (step.answered) answered[step.id] = given[step.id];
      }
      const last = steps[steps.length - 1];
      assert.equal(last.k, last.n, `${site.id} #${run}: K = N at the end`);
      assert.equal(page.screen, "result");
    }
  }
});

test("QP-3c: the small file S1 - the numbers of design 5.3, the seven rows, as text on every step and after 'Back' with a change of the answer; the answer to the hidden question is gone from the storage", async (t) => {
  const s1 = s1Site();
  const page = await begin(t, { sites: [s1] });
  const shown = () => [page.qTitle, page.part("progress-text").text];
  // 1: nothing answered
  assert.deepEqual(shown(), ["Question a", "Вопрос 1 из 6"]);
  await page.answer("p");
  await page.tap("next");
  assert.deepEqual(shown(), ["Question b", "Вопрос 2 из 5"]); // row 2
  await page.answer("p");
  await page.tap("next");
  assert.deepEqual(shown(), ["Question d", "Вопрос 3 из 5"]); // row 3
  await page.answer("p");
  await page.tap("next");
  assert.deepEqual(shown(), ["Question e", "Вопрос 4 из 5"]); // row 4
  await page.answer("q");
  await page.tap("next");
  assert.deepEqual(shown(), ["Question f", "Вопрос 5 из 5"]); // row 5: K = N
  for (let i = 0; i < 4; i += 1) await page.tap("back"); // f e d b a
  assert.equal(page.qTitle, "Question a");
  assert.equal(page.chosen(), "p");
  assert.deepEqual(page.stored("file-s1").answers, {
    a: "p",
    b: "p",
    d: "p",
    e: "q",
  });
  await page.answer("q"); // opens c, hides b
  assert.deepEqual(shown(), ["Question a", "Вопрос 1 из 6"]); // row 6
  assert.deepEqual(page.stored("file-s1").answers, { a: "q", d: "p", e: "q" });
  await page.tap("next");
  assert.deepEqual(shown(), ["Question c", "Вопрос 2 из 5"]); // row 7
  assert.equal(page.live.text, "Вопрос 2 из 5");
});

test("QP-3d: a file of three questions where the last depends on the one before - on that question the page shows 'Question 2 of 3' with 'Show the result' (the known edge accepted in decisions/0078, item 8: K is smaller than N at the end)", async (t) => {
  const site = customSite({
    id: "edge-three",
    questions: [
      single("a", "A", ["x", "y"]),
      single("b", "B", ["x", "y"]),
      single("c", "C", ["x", "y"], {
        show_if: [{ question: "b", any_of: ["x"] }],
      }),
    ],
  });
  const page = await begin(t, { sites: [site] });
  await page.answer("x");
  await page.tap("next");
  assert.equal(page.part("progress-text").text, "Вопрос 2 из 3");
  await page.answer("y");
  assert.equal(
    page.must('[data-part="next"]').attr("data-action"),
    "show-result",
  );
  assert.equal(page.part("progress-text").text, "Вопрос 2 из 3");
});

test("QP-3e: a change of an earlier answer that hides a question with an answer and opens another one - N, K, the answers and the stored value follow the table (uchet-pro, 'business' from retail to wholesale and back)", async (t) => {
  const page = await begin(t);
  const progress = () => page.part("progress-text").text;
  await page.answer("wholesale");
  await page.tap("next");
  assert.equal(progress(), "Вопрос 2 из 12"); // documents is visible now: 9 + 3 hidden
  for (const [id, value] of UP_PATH.slice(1)) {
    await page.answer(value);
    await page.tap("next");
    if (id === "staff") break;
  }
  // recount is hidden (problems = losses), documents follows
  assert.equal(page.qTitle, titleOf(up, "documents"));
  assert.equal(progress(), "Вопрос 7 из 10");
  await page.answer("docs-few");
  assert.equal(page.stored(UP).answers.documents, "docs-few");
  for (let i = 0; i < 6; i += 1) await page.tap("back");
  assert.equal(page.qTitle, titleOf(up, "business"));
  assert.equal(progress(), "Вопрос 1 из 12");
  assert.equal(page.chosen(), "wholesale");
  await page.answer("retail");
  assert.equal(progress(), "Вопрос 1 из 12");
  assert.deepEqual(page.stored(UP).answers, {
    business: "retail",
    items: 120,
    places: "one-place",
    tools: ["paper"],
    problems: ["losses"],
    staff: 3,
  });
  assert.equal(Object.hasOwn(page.stored(UP).answers, "documents"), false);
  // and forward again: documents does not come back
  await page.tap("next");
  assert.equal(progress(), "Вопрос 2 из 11");
});

// ---------------------------------------------------------------------- QP-4

test("QP-4a: after the answer to the third question, a new load of the page with the same storage offers 'Continue', and it opens the third question with the three answers chosen", async (t) => {
  const page = await begin(t);
  await page.answer("retail");
  await page.tap("next");
  await page.answer(120);
  await page.tap("next");
  await page.answer("one-place");
  await page.reload();
  assert.equal(page.screen, "card");
  assert.equal(page.action("continue").text, "Продолжить");
  assert.equal(page.all('[data-action="start"]').length, 0);
  await page.tap("continue");
  assert.equal(page.qTitle, titleOf(up, "places"));
  assert.equal(page.chosen(), "one-place");
  await page.tap("back");
  assert.equal(page.must("input").value, "120");
  await page.tap("back");
  assert.equal(page.chosen(), "retail");
  assert.deepEqual(page.stored(UP).answers, {
    business: "retail",
    items: 120,
    places: "one-place",
  });
  // the place alone is saved too (design 5.1, D5): the first question is optional, 'Next'
  // with no answer, a new load - 'Continue' is offered and opens the second question
  const optionalFirst = customSite({
    id: "place-alone",
    questions: [
      single("a", "A", ["x", "y"], { required: false }),
      single("b", "B", ["x", "y"]),
    ],
  });
  const alone = await begin(t, { sites: [optionalFirst] });
  await alone.tap("next");
  assert.equal(alone.qTitle, "B");
  assert.deepEqual(alone.stored("place-alone").answers, {});
  assert.equal(alone.stored("place-alone").current, "b");
  await alone.reload();
  assert.equal(alone.screen, "card");
  assert.ok(alone.action("continue"), "'Continue' is offered");
  assert.equal(alone.action("continue").text, "Продолжить");
  assert.equal(alone.action("restart").text, "Начать заново");
  assert.equal(alone.all('[data-action="start"]').length, 0);
  await alone.tap("continue");
  assert.equal(alone.qTitle, "B", "'Continue' opens the second question");
  assert.equal(alone.chosen(), null);
  assert.equal(alone.net.posts.length, 0);
});

test("QP-4b: another version of the questionnaire - the saved answers and the place are gone, the notice stands, the language stays in the value; the next load is an ordinary card without the notice; a value with no answers gives no notice", async (t) => {
  const other = "e".repeat(64);
  const value = JSON.stringify({
    format: 1,
    version: other,
    lang: "kk",
    current: "items",
    answers: { business: "retail" },
  });
  const page = await loadPage(t, {
    storage: { initial: { [KEY(UP)]: value } },
  });
  assert.equal(page.lang, "kk");
  assert.equal(page.part("notice").text, PAGE_TEXTS.card_changed[1]);
  assert.equal(page.all('[data-action="continue"]').length, 0);
  assert.deepEqual(page.stored(UP), {
    format: 1,
    version: up.version,
    lang: "kk",
    current: null,
    answers: {},
  });
  await page.reload();
  assert.equal(page.all('[data-part="notice"]').length, 0);
  assert.equal(page.action("start").text, PAGE_TEXTS.card_start[1]);
  // no answers: no notice, and the value is not rewritten
  const quiet = JSON.stringify({
    format: 1,
    version: other,
    lang: "ru",
    current: "business",
    answers: {},
  });
  const q = await loadPage(t, { storage: { initial: { [KEY(UP)]: quiet } } });
  assert.equal(q.all('[data-part="notice"]').length, 0);
  assert.equal(q.storage.data.get(KEY(UP)), quiet);
  assert.equal(q.storage.sets().length, 0);
  // "something to lose" is answers OR a place beyond the first question (design 5.2,
  // B1): each clause alone gives the notice, the value is cleared and the language stays
  const clauses = [
    [
      "answers only, the place is the first question",
      "kk",
      "business",
      { business: "retail" },
    ],
    ["a place beyond the first question, no answers", "en", "items", {}],
  ];
  for (const [name, lang, current, answers] of clauses) {
    const stored = JSON.stringify({
      format: 1,
      version: other,
      lang,
      current,
      answers,
    });
    const alone = await loadPage(t, {
      storage: { initial: { [KEY(UP)]: stored } },
    });
    assert.equal(alone.lang, lang, name);
    assert.equal(
      alone.part("notice").text,
      PAGE_TEXTS.card_changed[LANGS.indexOf(lang)],
      name,
    );
    assert.equal(alone.all('[data-action="continue"]').length, 0, name);
    assert.deepEqual(
      alone.stored(UP),
      { format: 1, version: up.version, lang, current: null, answers: {} },
      name,
    );
    await alone.reload();
    assert.equal(alone.all('[data-part="notice"]').length, 0, name);
  }
});

test("QP-4c: a storage that throws - when read, when written, and both - the questionnaire is passed to the result with no error, there is no 'Continue', and after the first failure the page does not touch the storage again", async (t) => {
  const cases = [
    ["read", { failGet: true }, { gets: 1, sets: 0 }],
    ["write", { failSet: true }, { gets: 1, sets: 1 }],
    [
      "both",
      { failGet: true, failSet: true, failRemove: true },
      { gets: 1, sets: 0 },
    ],
  ];
  for (const [label, storage, expected] of cases) {
    const page = await loadPage(t, { storage });
    assert.equal(page.screen, "card", label);
    assert.equal(page.all('[data-action="continue"]').length, 0, label);
    await page.tap("start");
    const rng = makeRng(57020);
    await walkForward(page, up, rng, { omitRate: 0 });
    assert.equal(page.screen, "result", label);
    assert.equal(page.storage.gets().length, expected.gets, label);
    assert.equal(page.storage.sets().length, expected.sets, label);
    assert.equal(page.storage.removes().length, 0, label);
    assert.deepEqual(
      page.strays(),
      {
        console: [],
        rejections: [],
        dialogs: [],
        misuse: [],
        storageMisuse: [],
      },
      label,
    );
    // start over after the failure does not touch the storage either
    await page.tap("restart");
    assert.equal(page.storage.removes().length, 0, label);
  }
  // the property localStorage itself refuses
  const refusing = await loadPage(t, { storage: null });
  assert.equal(refusing.screen, "card");
  await refusing.tap("start");
  await walkForward(refusing, up, makeRng(57021), { omitRate: 0 });
  assert.equal(refusing.screen, "result");
  assert.deepEqual(refusing.rejections, []);
});

test("QP-4d: a change of an earlier answer that hides a question - the answer to it is gone from the stored value and from the body of the request of the result", async (t) => {
  const page = await begin(t);
  await page.answer("wholesale");
  await page.tap("next");
  for (const [id, value] of UP_PATH.slice(1)) {
    await page.answer(value);
    await page.tap("next");
    if (id === "staff") break;
  }
  await page.answer("docs-many");
  for (let i = 0; i < 6; i += 1) await page.tap("back");
  await page.answer("retail");
  assert.equal(Object.hasOwn(page.stored(UP).answers, "documents"), false);
  await walkForward(page, up, makeRng(57030), { omitRate: 0 });
  assert.equal(page.screen, "result");
  const body = page.net.posts[0].body;
  assert.equal(Object.hasOwn(body.answers, "documents"), false);
  assert.equal(body.answers.business, "retail");
});

test("QP-4e: twelve kinds of stored value that are not what the page wrote - the first load is as a clean one (the language is taken if it is right), nothing is thrown, the value is not erased before the first answer, and no object is polluted", async (t) => {
  const good = {
    format: 1,
    version: up.version,
    lang: "ru",
    current: "business",
    answers: { business: "retail" },
  };
  const bad = [
    "not json {",
    "null",
    "[]",
    "42",
    '"text"',
    "",
    JSON.stringify({ ...good, format: 2 }),
    JSON.stringify({ ...good, lang: "kk", version: "xyz" }),
    JSON.stringify({ ...good, answers: ["retail"] }),
    JSON.stringify({ ...good, pad: "x".repeat(40000) }),
    `{"format":1,"version":"${up.version}","lang":"ru","current":"business","answers":{"__proto__":{"polluted":1},"constructor":{"x":1},"business":{"deep":1}}}`,
    JSON.stringify({
      ...good,
      current: "c".repeat(70),
      answers: { items: "text", places: 3.5 },
    }),
  ];
  assert.equal(bad.length, 12);
  for (const [index, value] of bad.entries()) {
    const page = await loadPage(t, {
      storage: { initial: { [KEY(UP)]: value } },
    });
    const label = `${index}: ${value.slice(0, 40)}`;
    assert.equal(page.screen, "card", label);
    assert.equal(page.all('[data-action="continue"]').length, 0, label);
    assert.equal(page.action("start") !== null, true, label);
    assert.equal(page.storage.data.get(KEY(UP)), value, `${label}: not erased`);
    assert.equal(page.storage.sets().length, 0, label);
    assert.deepEqual(page.rejections, [], label);
    assert.equal({}.polluted, undefined, label);
    assert.equal(Object.prototype.polluted, undefined, label);
    if (index === 7)
      assert.equal(
        page.lang,
        "kk",
        "the language of a value with a wrong version",
      );
    await page.tap("start");
    assert.equal(
      page.storage.data.get(KEY(UP)),
      value,
      `${label}: start writes nothing`,
    );
    await page.answer("retail");
    assert.equal(page.stored(UP).answers.business, "retail", label);
  }
});

test("QP-4f: a stored value with an unknown id, an answer of the wrong kind and an answer to a hidden question - 'Continue' opens the question that is not answered rightly, the right answers stay, the rest are dropped", async (t) => {
  const value = JSON.stringify({
    format: 1,
    version: up.version,
    lang: "ru",
    current: "places",
    answers: {
      business: "retail",
      items: 120,
      places: "nowhere",
      zzz: "x",
      documents: "docs-few",
      tools: ["paper", "paper"],
    },
  });
  const page = await loadPage(t, {
    storage: { initial: { [KEY(UP)]: value } },
  });
  assert.ok(page.action("continue"));
  await page.tap("continue");
  assert.equal(page.qTitle, titleOf(up, "places"));
  assert.equal(page.chosen(), null);
  assert.deepEqual(page.stored(UP).answers, { business: "retail", items: 120 });
  await page.tap("back");
  assert.equal(page.must("input").value, "120");
  await page.tap("back");
  assert.equal(page.chosen(), "retail");
});

test("QP-4g: a saved place beyond the first required question without an answer - 'Continue' opens that question, not the saved place", async (t) => {
  const value = savedValue(up, {
    current: "goal",
    answers: { business: "retail" },
  });
  const page = await loadPage(t, {
    storage: { initial: { [KEY(UP)]: value } },
  });
  await page.tap("continue");
  assert.equal(page.qTitle, titleOf(up, "items"));
  assert.equal(page.net.posts.length, 0);
  // the saved place before the first open question stays
  const early = savedValue(up, {
    current: "business",
    answers: { business: "retail", items: 120 },
  });
  const p = await loadPage(t, { storage: { initial: { [KEY(UP)]: early } } });
  await p.tap("continue");
  assert.equal(p.qTitle, titleOf(up, "business"));
});

// ---------------------------------------------------------------------- QP-5

// The log of the page since `mark`: the position of the first scroll and of the last focus.
function moves(page, mark) {
  const slice = page.log.slice(mark);
  const focusAt = slice.map((e) => e.op).lastIndexOf("focus");
  const scrollAt = slice.findIndex((e) => e.op === "scroll");
  return { slice, focusAt, scrollAt };
}

test("QP-5a: after every move the focus is on the heading of the new screen (tabindex -1), after the scroll to the top and with preventScroll; on a refusal on the first field; in a block of the net on its button; after a change of the language on its button; the first drawing of the card moves no focus", async (t) => {
  const page = await loadPage(t);
  same(page.active, page.doc.body, "the first drawing moves no focus");
  const expectHeading = async (action, selector) => {
    const mark = page.log.length;
    await action();
    const heading = page.must(selector);
    same(page.active, heading, selector);
    assert.equal(heading.attr("tabindex"), "-1", selector);
    const { slice, focusAt, scrollAt } = moves(page, mark);
    assert.ok(
      scrollAt !== -1 && scrollAt < focusAt,
      `${selector}: scroll before focus`,
    );
    assert.deepEqual(slice[scrollAt].args, {
      top: 0,
      left: 0,
      behavior: "instant",
    });
    assert.deepEqual(slice[focusAt].options, { preventScroll: true });
  };
  await expectHeading(() => page.tap("start"), "h2");
  await page.answer("retail");
  await expectHeading(() => page.tap("next"), "h2");
  assert.equal(page.qTitle, titleOf(up, "items"));
  await expectHeading(() => page.tap("back"), "h2");
  assert.equal(page.qTitle, titleOf(up, "business"));
  // 'Continue' after a new load
  await page.reload();
  same(page.active, page.doc.body);
  await page.tap("continue");
  same(page.active, page.must("h2"));
  // a refusal puts the focus on the first field, not on the message; skip; the language
  const optional = customSite({
    id: "optional-focus",
    languages: ["ru", "kk", "en"],
    questions: [
      single("a", "A", ["x", "y"], { required: false }),
      single("b", "B", ["x", "y"]),
    ],
  });
  const p = await begin(t, { sites: [optional] });
  await p.tap("next");
  same(p.active, p.must("h2"));
  assert.equal(p.qTitle, "B");
  await p.tap("show-result");
  assert.equal(p.qTitle, "B", "refused");
  same(p.active, p.inputs[0]);
  await p.tap("back");
  await p.tap("skip");
  same(p.active, p.must("h2"));
  // after a change of the language: the button of the language
  await p.click(p.langButton("kk"));
  same(p.active, p.langButton("kk"));
  // the result: the heading of the result screen
  await p.answer("x");
  await p.tap("show-result");
  assert.equal(p.screen, "result");
  same(p.active, p.part("result-title"));
  assert.equal(p.part("result-title").attr("tabindex"), "-1");
});

test("QP-5a2: after a failure of the net the focus is on the button of the block; 'Try again' after a failed load puts it on the heading of the card; a new load with saved answers - 'Continue' puts it on the heading of the question", async (t) => {
  const page = await loadPage(t, { start: false });
  page.net.on((r) => r.method === "GET", "network");
  await page.run();
  assert.equal(page.screen, "failure");
  same(page.active, page.part("net-action"));
  await page.tap("retry");
  assert.equal(page.screen, "card");
  same(page.active, page.part("title"), "the h1 of the card");
  assert.equal(page.part("title").attr("tabindex"), "-1");
});

test("QP-5b: the names for the readers - the group of the answers is named by the heading, described by the help and, while there is one, by the message; the number field likewise with the hint; aria-invalid; the block of the net is read once (no alert) and its button is tied to its text; the live region is in index.html with its three marks; the buttons of languages carry their lang", async (t) => {
  const page = await loadPage(t);
  const live = page.doc.byId("live");
  assert.equal(live.attr("role"), "status");
  assert.equal(live.attr("aria-live"), "polite");
  assert.equal(live.attr("aria-atomic"), "true");
  assert.equal(page.must('[data-part="languages"]').attr("aria-label"), "Язык");
  assert.deepEqual(
    page.langButtons.map((b) => [b.attr("lang"), b.attr("type"), b.text]),
    [
      ["ru", "button", "Русский"],
      ["kk", "button", "Қазақша"],
      ["en", "button", "English"],
    ],
  );
  await page.tap("start");
  // a question with a help: the group is described by the help
  await goThrough(page, UP_PATH, "problems");
  assert.equal(page.qTitle, titleOf(up, "problems"));
  const set = page.must("fieldset");
  assert.equal(set.attr("aria-labelledby"), "q-title");
  assert.equal(set.attr("aria-describedby"), "q-help");
  assert.equal(
    page.part("q-help").text,
    say(questionOf(up, "problems").help, "ru"),
  );
  await page.tap("next");
  assert.equal(page.part("q-error").text, PAGE_TEXTS.quiz_required[0]);
  assert.equal(set.attr("aria-describedby"), "q-help q-error");
  await page.answer(["losses"]);
  assert.equal(set.attr("aria-describedby"), "q-help");
  // a number with a help and a hint
  const items = await begin(t);
  await items.answer("retail");
  await items.tap("next");
  const field = items.must("input");
  assert.equal(field.attr("aria-describedby"), "q-help q-hint");
  await items.type(field, "abc");
  await items.tap("next");
  assert.equal(field.attr("aria-describedby"), "q-help q-hint q-error");
  assert.equal(field.attr("aria-invalid"), "true");
  await items.type(field, "5");
  assert.equal(field.attr("aria-describedby"), "q-help q-hint");
  assert.equal(field.attr("aria-invalid"), null);
  // the block of the net
  const lost = await loadPage(t, { start: false });
  lost.net.on((r) => r.method === "GET", "network");
  await lost.run();
  const block = lost.part("net");
  assert.equal(block.attr("role"), null);
  assert.equal(block.attr("data-kind"), "load");
  assert.equal(lost.part("net-action").attr("aria-describedby"), "net-text");
  assert.equal(lost.must("#net-text").text, PAGE_TEXTS.net_lost_saved[0]);
});

test("QP-5c: the order in the tree is the order of the tabs: the buttons of languages, the answers, 'Back', 'Skip', 'Next'", async (t) => {
  const site = customSite({
    id: "tab-order",
    languages: ["ru", "kk", "en"],
    questions: [
      single("a", "A", ["x", "y"]),
      single("b", "B", ["x", "y", "z"], { required: false }),
    ],
  });
  const page = await begin(t, { sites: [site] });
  await page.answer("x");
  await page.tap("next");
  const order = page
    .all("button, input")
    .map((n) =>
      n.tag === "input" ? `${n.attr("type")}:${n.value}` : n.attr("data-part"),
    );
  assert.deepEqual(order, [
    "lang",
    "lang",
    "lang",
    "radio:x",
    "radio:y",
    "radio:z",
    "back",
    "skip",
    "next",
  ]);
});

// ---------------------------------------------------------------------- QP-6

const NO_STRAYS = {
  console: [],
  rejections: [],
  dialogs: [],
  misuse: [],
  storageMisuse: [],
};

test("QP-6a: the storage of the page - a whole pass with a change of the language touches only getItem, setItem and removeItem and only the key of the tenant; the keys of another tenant and a stranger stay as they were; nothing is listed", async (t) => {
  const other = savedValue(sm, {
    current: "place",
    answers: { place: "cafe" },
  });
  const page = await loadPage(t, {
    storage: { initial: { [KEY(SM)]: other, foreign: "keep" } },
  });
  await page.tap("start");
  for (const [, value] of UP_PATH.slice(0, 3)) {
    await page.answer(value);
    await page.tap("next");
  }
  await page.click(page.langButton("kk"));
  await walkForward(page, up, makeRng(57040), { omitRate: 0 });
  assert.equal(page.screen, "result");
  await page.reload();
  await page.tap("restart");
  const ops = new Set(page.storage.log.map((e) => e.op));
  assert.deepEqual([...ops].sort(), ["getItem", "removeItem", "setItem"]);
  for (const entry of page.storage.log)
    assert.equal(entry.key, KEY(UP), JSON.stringify(entry));
  assert.equal(page.storage.data.get(KEY(SM)), other);
  assert.equal(page.storage.data.get("foreign"), "keep");
  assert.deepEqual(page.storage.misuse, []);
  assert.deepEqual(page.strays(), NO_STRAYS);
});

test("QP-6b: every value written is five keys - format, version, lang, current, answers - with only ids of questions in the answers; no name, phone, e-mail or contact; the language is always there", async (t) => {
  const page = await begin(t);
  await walkForward(page, up, makeRng(57041), { omitRate: 0.5 });
  await page.reload();
  await page.tap("continue");
  await page.click(page.langButton("en"));
  const writes = page.storage.sets();
  assert.ok(writes.length >= 10, `${writes.length} writes`);
  const ids = new Set(up.plain.questions.map((q) => q.id));
  for (const { value } of writes) {
    const parsed = JSON.parse(value);
    assert.deepEqual(Object.keys(parsed).sort(), [
      "answers",
      "current",
      "format",
      "lang",
      "version",
    ]);
    assert.ok(LANGS.includes(parsed.lang), value);
    assert.equal(parsed.format, 1);
    assert.equal(parsed.version, up.version);
    for (const key of Object.keys(parsed.answers)) assert.ok(ids.has(key), key);
    assert.doesNotMatch(value, /name|phone|e-?mail|contact|consent/iu);
  }
});

test("QP-6c: a change of the language writes only the key of the tenant and changes in it only the language; the answers and the place stay", async (t) => {
  const page = await begin(t);
  await page.answer("retail");
  await page.tap("next");
  await page.answer(120);
  const before = page.stored(UP);
  const others = { ...page.storage.snapshot() };
  delete others[KEY(UP)];
  const writes = page.storage.sets().length;
  await page.click(page.langButton("kk"));
  assert.equal(page.storage.sets().length, writes + 1);
  assert.deepEqual(page.stored(UP), { ...before, lang: "kk" });
  const after = { ...page.storage.snapshot() };
  delete after[KEY(UP)];
  assert.deepEqual(after, others);
});

test("QP-6d: a page that is not at /t/<id>/ - the root, a path with no closing slash, an empty id, a nested path, an id of 65 signs - does not touch the storage at all", async (t) => {
  const long = "a".repeat(65);
  const sites = [
    customSite({ id: long, questions: [single("a", "A", ["x", "y"])] }),
    up,
  ];
  const paths = [
    "/",
    "/t/uchet-pro",
    "/t//",
    "/t/uchet-pro/x/",
    "/assets/index.html",
  ];
  for (const path of paths) {
    const page = await loadPage(t, { path, sites });
    assert.equal(page.screen, "failure", path);
    assert.deepEqual(page.storage.log, [], path);
    assert.deepEqual(page.strays(), NO_STRAYS, path);
  }
  // an id of 65 signs: the server may know it, the page still keeps the storage out
  const page = await loadPage(t, { path: `/t/${long}/`, sites });
  assert.equal(page.screen, "card");
  await page.tap("start");
  await page.answer("x");
  await page.tap("show-result");
  assert.equal(page.screen, "result");
  assert.deepEqual(page.storage.log, []);
  assert.deepEqual(page.strays(), NO_STRAYS);
  // the failure text of the server stands in the block (the questionnaire was not found)
  const lost = await loadPage(t, { path: "/assets/index.html" });
  assert.equal(lost.screen, "failure");
  assert.equal(
    lost.must("#net-text").text,
    "Страница не найдена. / Бет табылмады. / Page not found.",
  );
  assert.equal(lost.part("net-action").text, "Повторить");
});

// ---------------------------------------------------------------------- QP-7

const GET = (r) => r.method === "GET";
const POST = (r) => r.method === "POST";

test("QP-7a: no net at the load - a screen with no header, the text of the lost net (saved when the storage works, 'only here' when it does not) and one button 'Try again'; no request goes by itself; the button asks again and opens the card with the focus on its heading; one request for one press", async (t) => {
  for (const [label, storage, key] of [
    ["storage works", {}, "net_lost_saved"],
    ["storage refuses", { failGet: true }, "net_lost_unsaved"],
  ]) {
    const page = await loadPage(t, { start: false, storage });
    page.net.on(GET, "network");
    await page.run();
    assert.equal(page.screen, "failure", label);
    assert.equal(page.must("#net-text").text, PAGE_TEXTS[key][0], label);
    assert.deepEqual(
      page.all("button").map((b) => b.text),
      ["Повторить"],
      label,
    );
    assert.equal(page.all("header, h1, h2").length, 0, `${label}: no header`);
    assert.equal(page.part("net").attr("data-kind"), "load");
    await settle(20);
    assert.equal(page.net.requests.length, 1, `${label}: no request by itself`);
    assert.equal(page.storage.sets().length, 0, label);
    await page.tap("retry");
    assert.equal(page.net.requests.length, 2, label);
    assert.equal(page.screen, "card", label);
    same(page.active, page.part("title"), label);
  }
});

test("QP-7b: no net at 'Show the result' - the block stands under the buttons, the question and the answers stay as they were, nothing is written; 'Try again' sends the same body byte for byte, and after 200 the screen of the result opens", async (t) => {
  const page = await begin(t);
  page.net.on(POST, "network");
  const { given } = await walkForward(page, up, makeRng(57050), {
    omitRate: 0,
    stopAtResult: true,
  });
  const last = page.currentQuestion(up);
  const snapshot = page.storage.snapshot();
  const chosen = page.chosen();
  const gets = page.net.gets.length;
  await page.tap("show-result");
  assert.equal(page.screen, "question");
  assert.equal(page.currentQuestion(up).id, last.id);
  const block = page.must('[data-part="net-slot"] [data-part="net"]');
  assert.equal(block.attr("data-kind"), "result");
  assert.equal(page.must("#net-text").text, PAGE_TEXTS.net_lost_saved[0]);
  assert.equal(page.chosen(), chosen);
  assert.deepEqual(page.storage.snapshot(), snapshot, "nothing is written");
  assert.equal(page.net.gets.length, gets);
  assert.equal(page.net.posts.length, 1);
  same(page.active, page.part("net-action"));
  assert.equal(
    page.must("fieldset").attr("disabled"),
    null,
    "the fields are open again",
  );
  assert.equal(page.must('[data-part="next"]').attr("aria-disabled"), null);
  // while 'Try again' is on its way the block is gone (design 5.2, R1); the answer, if
  // it fails again, brings one block back
  const again = page.net.hold(POST);
  await page.tap("retry");
  assert.ok(again.request, "the second request is open");
  assert.equal(page.all('[data-part="net"]').length, 0, "no block in flight");
  assert.equal(page.screen, "question");
  assert.equal(page.must("fieldset").attr("disabled"), "");
  again.respond("network");
  await settle();
  assert.equal(page.all('[data-part="net"]').length, 1, "one block again");
  assert.equal(page.part("net").attr("data-kind"), "result");
  assert.equal(page.must("fieldset").attr("disabled"), null);
  const third = page.net.hold(POST);
  await page.tap("retry");
  assert.equal(page.all('[data-part="net"]').length, 0);
  third.respond({ status: 200, body: RESULT_OK });
  await settle();
  assert.equal(page.screen, "result");
  assert.equal(page.all('[data-part="net"]').length, 0);
  assert.equal(page.net.posts.length, 3);
  assert.equal(page.net.posts[1].bodyText, page.net.posts[0].bodyText);
  assert.equal(page.net.posts[2].bodyText, page.net.posts[0].bodyText);
  assert.deepEqual(page.net.posts[1].body, { answers: given });
  assert.equal(page.screen, "result");
  assert.equal(page.part("result-title").text, PAGE_TEXTS.result_soon[0]);
});

test("QP-7c: answers of the server - 500 with a text shows that text; 500 with no body, 502 with a page of markup - the general text in the language of the page; 400 answers_invalid at the result - 'Start over' instead of 'Try again', and the storage is touched only by that button; at the load of the questionnaire and at a change of the language the rule is: 'Try again' only at the load", async (t) => {
  const page = await begin(t, { search: "?lang=kk" });
  await page.tap("start").catch(() => {});
  const walk = await walkForward(page, up, makeRng(57060), {
    omitRate: 0,
    stopAtResult: true,
  });
  assert.ok(walk.steps.length >= 7);
  const snapshot = page.storage.snapshot();
  const block = () => page.must('[data-part="net-slot"] [data-part="net"]');
  const cases = [
    [
      {
        status: 500,
        body: { error: "internal", message: "The server says so." },
      },
      "The server says so.",
      "retry",
    ],
    [{ status: 500, text: "" }, SERVER_TEXTS.server_internal[1], "retry"],
    [
      { status: 502, text: "<html><body>Bad gateway</body></html>" },
      SERVER_TEXTS.server_internal[1],
      "retry",
    ],
    [
      { status: 200, text: "not json" },
      SERVER_TEXTS.server_internal[1],
      "retry",
    ],
    [
      { status: 200, body: { recommended: "no" } },
      SERVER_TEXTS.server_internal[1],
      "retry",
    ],
    [
      {
        status: 400,
        body: { error: "answers_invalid", message: "Answers do not fit." },
      },
      "Answers do not fit.",
      "restart",
    ],
    [
      { status: 400, body: { error: "answers_invalid" } },
      SERVER_TEXTS.server_answers_invalid[1],
      "restart",
    ],
  ];
  for (const [spec, text, action] of cases) {
    page.net.on(POST, spec);
    await page.tap("show-result");
    assert.equal(page.screen, "question", JSON.stringify(spec));
    assert.equal(block().attr("data-kind"), "result");
    assert.equal(page.must("#net-text").text, text, JSON.stringify(spec));
    assert.equal(
      page.part("net-action").attr("data-action"),
      action,
      JSON.stringify(spec),
    );
    assert.equal(
      page.part("net-action").text,
      action === "retry" ? "Қайталау" : "Қайтадан бастау",
    );
    assert.deepEqual(
      page.storage.snapshot(),
      snapshot,
      "the storage is not touched",
    );
    assert.deepEqual(page.storage.removes(), []);
    assert.equal(
      page.all('[data-part="net"]').length,
      1,
      "one block at a time",
    );
    assert.equal(page.all("#net-text").length, 1);
  }
  // the button 'Start over' erases the key of the tenant and opens the card with no 'Continue'
  await page.tap("restart");
  assert.deepEqual(page.storage.removes(), [
    { op: "removeItem", key: KEY(UP) },
  ]);
  assert.equal(page.storage.data.has(KEY(UP)), false);
  assert.equal(page.screen, "card");
  assert.equal(page.all('[data-action="continue"]').length, 0);
  same(page.active, page.part("title"));
  // at the load of the questionnaire: "answers_invalid" gives 'Try again', never 'Start over'
  const load = await loadPage(t, { start: false });
  load.net.on(GET, {
    status: 400,
    body: { error: "answers_invalid", message: "Say it again." },
  });
  await load.run();
  assert.equal(load.screen, "failure");
  assert.equal(load.must("#net-text").text, "Say it again.");
  assert.equal(load.part("net-action").attr("data-action"), "retry");
  assert.equal(load.all('[data-action="restart"]').length, 0);
  assert.deepEqual(
    load.all("button").map((b) => b.text),
    ["Повторить"],
  );
  // at a change of the language the rule of the result holds ('Start over')
  const lang = await begin(t);
  await lang.answer("retail");
  lang.net.on(GET, { status: 400, body: { error: "answers_invalid" } });
  await lang.click(lang.langButton("kk"));
  assert.equal(lang.part("net").attr("data-kind"), "lang");
  assert.equal(lang.part("net-action").attr("data-action"), "restart");
  assert.equal(lang.lang, "ru");
});

test("QP-7d: every request carries a signal of the limit of time (20 seconds) and the page asks for no more than the browser does by itself: no mode, no referrer policy, no credentials; a request that is aborted by its signal is 'no net'", async (t) => {
  const page = await begin(t);
  await walkForward(page, up, makeRng(57070), { omitRate: 0 });
  await page.click(page.langButton("kk"));
  assert.ok(page.net.requests.length >= 3);
  for (const req of page.net.requests) {
    assert.ok(req.signal instanceof AbortSignal, `#${req.n}`);
    assert.ok(
      req.init.signal === req.signal && req.signal !== null,
      `#${req.n}`,
    );
    for (const key of Object.keys(req.init))
      assert.ok(
        ["method", "headers", "body", "signal"].includes(key),
        `#${req.n}: ${key}`,
      );
    assert.equal(req.target.startsWith("api/"), true, req.target);
  }
  assert.ok(page.net.timeouts.length >= page.net.requests.length);
  assert.ok(page.net.timeouts.every((x) => x.ms === 20000));
  const post = page.net.posts[0];
  assert.deepEqual(post.headers, { "content-type": "application/json" });
  assert.deepEqual(Object.keys(post.body), ["answers"]);
  // an aborted request: the same as no net
  const lost = await loadPage(t, { start: false });
  const hold = lost.net.hold(GET);
  await lost.run();
  assert.ok(hold.request);
  lost.net.timeouts[0].controller.abort(
    new DOMException("timeout", "TimeoutError"),
  );
  await settle();
  assert.equal(lost.screen, "failure");
  assert.equal(lost.must("#net-text").text, PAGE_TEXTS.net_lost_saved[0]);
  assert.deepEqual(lost.rejections, []);
});

test("QP-7e: the whole scenario of the failures - a lost net at the load, at the result and at a change of the language, errors of the server, a timeout - the page writes nothing to the console, leaves no promise unhandled and calls no window", async (t) => {
  const page = await loadPage(t, { start: false });
  page.net.on(GET, "network");
  await page.run();
  await page.tap("retry");
  await page.tap("start");
  await walkForward(page, up, makeRng(57080), {
    omitRate: 0,
    stopAtResult: true,
  });
  page.net.on(POST, "network");
  await page.tap("show-result");
  page.net.on(POST, { status: 500, text: "" });
  await page.tap("retry");
  page.net.on(GET, "network");
  await page.click(page.langButton("kk"));
  await page.tap("retry");
  assert.equal(page.lang, "kk");
  const hold = page.net.hold(POST);
  await page.tap("show-result");
  assert.ok(hold.request);
  page.net.timeouts[page.net.timeouts.length - 1].controller.abort(
    new DOMException("timeout", "TimeoutError"),
  );
  await settle(20);
  assert.equal(page.part("net").attr("data-kind"), "result");
  assert.deepEqual(page.strays(), NO_STRAYS);
});

test("QP-7f: no net at a change of the language - the block stands under the header; the language, the address, the value in the storage, the answers and the place stay as they were; 'Try again' makes the change", async (t) => {
  const page = await begin(t, { search: "?a=1" });
  await page.answer("retail");
  await page.tap("next");
  await page.answer(120);
  const snapshot = page.storage.snapshot();
  const search = page.loc.search;
  page.net.on(GET, "network");
  await page.click(page.langButton("kk"));
  const block = page.must('[data-part="head-net-slot"] [data-part="net"]');
  assert.equal(block.attr("data-kind"), "lang");
  assert.equal(page.must("#net-text").text, PAGE_TEXTS.net_lost_saved[0]);
  assert.equal(page.lang, "ru");
  assert.equal(page.langButton("ru").attr("aria-current"), "true");
  assert.equal(page.langButton("kk").attr("aria-current"), null);
  assert.equal(page.loc.search, search);
  assert.equal(page.replaces.length, 0);
  assert.deepEqual(page.storage.snapshot(), snapshot);
  assert.equal(page.qTitle, titleOf(up, "items"));
  assert.equal(page.must("input").value, "120");
  same(page.active, page.part("net-action"));
  // while 'Try again' is on its way the block is gone (design 5.2, R1), and the old
  // language stays until the answer comes
  const again = page.net.hold((r) => GET(r) && r.lang === "kk");
  await page.tap("retry");
  assert.ok(again.request, "the second request is open");
  assert.equal(page.all('[data-part="net"]').length, 0, "no block in flight");
  assert.equal(page.lang, "ru");
  again.respond({ status: 200, body: up.body("kk") });
  await settle();
  assert.equal(page.lang, "kk");
  assert.equal(page.qTitle, titleOf(up, "items", "kk"));
  assert.equal(page.loc.search, "?a=1&lang=kk");
  assert.equal(page.all('[data-part="net"]').length, 0);
  assert.equal(page.stored(UP).lang, "kk");
  // a failed change that fails again brings back one block, not two
  const twice = await begin(t);
  twice.net.on(GET, "network");
  await twice.click(twice.langButton("kk"));
  assert.equal(twice.all('[data-part="net"]').length, 1);
  twice.net.on(GET, "network");
  await twice.tap("retry");
  assert.equal(twice.all('[data-part="net"]').length, 1, "one block, not two");
  assert.equal(twice.part("net").attr("data-kind"), "lang");
  // a failed change of the language, then a failed result: the block of the result alone
  const both = await begin(t);
  await walkForward(both, up, makeRng(57160), {
    omitRate: 0,
    stopAtResult: true,
  });
  both.net.on(GET, "network");
  await both.click(both.langButton("kk"));
  assert.equal(
    both.all('[data-part="head-net-slot"] [data-part="net"]').length,
    1,
    "the block of the language stands under the header",
  );
  both.net.on(POST, "network");
  await both.tap("show-result");
  assert.equal(both.screen, "question");
  assert.equal(both.all('[data-part="net"]').length, 1, "one block, not two");
  assert.equal(both.part("net").attr("data-kind"), "result");
  assert.equal(
    both.all('[data-part="head-net-slot"] [data-part="net"]').length,
    0,
    "none under the header",
  );
  assert.equal(
    both.all('[data-part="net-slot"] [data-part="net"]').length,
    1,
    "the block of the result stands under the buttons",
  );
});

// ---------------------------------------------------------------------- QP-7g

test("QP-7g: while the result is asked for, the fields of the question are shut (a shut fieldset, the main button marked), the answers cannot change, the live region says so, a double click and a form sent again make one request; on a failure the fields open again", async (t) => {
  const page = await begin(t);
  const { given } = await walkForward(page, up, makeRng(57090), {
    omitRate: 0,
    stopAtResult: true,
  });
  const hold = page.net.hold(POST);
  const snapshot = page.storage.snapshot();
  const set = page.must("fieldset");
  assert.equal(set.attr("disabled"), null);
  await page.tap("show-result");
  assert.ok(hold.request, "the request is open");
  assert.equal(set.attr("disabled"), "");
  assert.ok(page.inputs.every((i) => i.disabled));
  assert.equal(page.must('[data-part="next"]').attr("aria-disabled"), "true");
  assert.equal(page.live.text, PAGE_TEXTS.quiz_sending[0]);
  // the visitor cannot change the answer
  const before = page.chosen();
  for (const input of page.inputs) {
    if (input.attr("type") === "number") typeNumber(input, "1");
    else choose(input);
  }
  await settle();
  assert.deepEqual(page.chosen(), before);
  assert.deepEqual(page.storage.snapshot(), snapshot);
  // a second click, Enter in the form and a sent form: still one request
  await page.tap("show-result");
  page.must("form").dispatch("submit");
  await page.enter(page.inputs[0]);
  await settle();
  assert.equal(page.net.posts.length, 1);
  assert.deepEqual(page.net.posts[0].body, { answers: given });
  assert.equal(page.net.posts[0].lang, "ru");
  hold.respond({
    status: 200,
    body: {
      clear_leader: true,
      recommended: [],
      no_match_text: null,
      hypotheses: [],
    },
  });
  await settle();
  assert.equal(page.screen, "result");
  assert.equal(page.net.posts.length, 1);
  // failure: the fields open again, the answers are the same
  const again = await begin(t);
  await walkForward(again, up, makeRng(57090), {
    omitRate: 0,
    stopAtResult: true,
  });
  const chosen = again.chosen();
  const fail = again.net.hold(POST);
  await again.tap("show-result");
  assert.equal(again.must("fieldset").attr("disabled"), "");
  fail.respond("network");
  await settle();
  assert.equal(again.must("fieldset").attr("disabled"), null);
  assert.equal(again.must('[data-part="next"]').attr("aria-disabled"), null);
  assert.ok(again.inputs.every((i) => !i.disabled));
  assert.deepEqual(again.chosen(), chosen);
  same(again.active, again.part("net-action"));
  assert.equal(again.net.posts.length, 1);
  // the answers cannot be changed during the request even through the code of the page:
  // the body and the stored value are those of the click
  assert.deepEqual(again.net.posts[0].body.answers, given);
  // 'Skip' and 'Back' stand outside the shut fieldset and do nothing while the request
  // is open: the answer that goes is the answer that is stored and the answer that the
  // result is shown for, and the question stays where it is
  const optional = customSite({
    id: "optional-held",
    questions: [
      single("first", "First", ["x", "y"]),
      single("last", "Last", ["x", "y"], { required: false }),
    ],
  });
  const o = await begin(t, { sites: [optional] });
  await o.answer("x");
  await o.tap("next");
  await o.answer("y");
  const open = o.net.hold(POST);
  await o.tap("show-result");
  assert.ok(open.request, "the request is open");
  assert.ok(o.action("skip") && o.action("back"), "both buttons are there");
  const stored = o.storage.snapshot();
  const writes = o.storage.sets().length;
  const removes = o.storage.removes().length;
  for (const action of ["skip", "back", "skip"]) {
    await o.tap(action);
    assert.equal(o.screen, "question", action);
    assert.equal(o.qTitle, "Last", `${action}: the question stays`);
    assert.equal(o.chosen(), "y", `${action}: the answer stays`);
    assert.deepEqual(o.storage.snapshot(), stored, `${action}: storage`);
    assert.equal(o.storage.sets().length, writes, `${action}: no write`);
    assert.equal(o.storage.removes().length, removes, `${action}: no erase`);
    assert.equal(o.net.posts.length, 1, `${action}: still one request`);
  }
  assert.deepEqual(o.stored("optional-held").answers, {
    first: "x",
    last: "y",
  });
  assert.equal(o.must("fieldset").attr("disabled"), "", "still shut");
  open.respond({ status: 200, body: RESULT_OK });
  await settle();
  assert.equal(o.screen, "result");
  assert.deepEqual(o.net.posts[0].body, { answers: { first: "x", last: "y" } });
  assert.deepEqual(o.stored("optional-held").answers, {
    first: "x",
    last: "y",
  });
  assert.equal(o.net.posts.length, 1);
});

// ---------------------------------------------------------------------- QP-8

const PAGE_KEYS = Object.keys(PAGE_TEXTS);

const wordsOf = (phrase) =>
  phrase.split(/\s+/u).filter((w) => /[\p{L}\p{N}]/u.test(w));
const phrasesOf = (text) =>
  text
    .split(/[.!?]+/u)
    .map((p) => p.trim())
    .filter((p) => p !== "");

test("QP-8a: the 23 texts of the page in three languages - none is longer than 18 words in a phrase, no 'ty' form in Russian, none of the words that the descriptions forbid, no promise word; texts.js holds exactly these texts", async () => {
  assert.equal(PAGE_KEYS.length, 23);
  const { TEXTS } = await import("../src/picker/public/texts.js");
  const parts = ["арендатор", "конфигурац", "configur"];
  const forbidden = ["json", "api", "сервер", "tenant", "server", "id"];
  const second =
    /(?<![\p{L}\p{N}])(ты|тебя|тебе|тобой|твой|твоя|твоё|твои)(?![\p{L}\p{N}])/iu;
  const promise = ["гарант", "кепіл", "guarant", "100 %", "100%"];
  for (const key of PAGE_KEYS) {
    assert.deepEqual(
      [TEXTS[key].ru, TEXTS[key].kk, TEXTS[key].en],
      PAGE_TEXTS[key],
      `${key}: texts.js equals the table of the tests`,
    );
    const placeholders = LANGS.map((l, i) =>
      [...PAGE_TEXTS[key][i].matchAll(/\{[a-z]+\}/gu)]
        .map((m) => m[0])
        .sort()
        .join(),
    );
    assert.equal(
      new Set(placeholders).size,
      1,
      `${key}: the same placeholders`,
    );
    for (const [i, lang] of LANGS.entries()) {
      const text = PAGE_TEXTS[key][i];
      for (const phrase of phrasesOf(text))
        assert.ok(
          wordsOf(phrase).length <= 18,
          `${key} ${lang}: ${wordsOf(phrase).length} words`,
        );
      const low = text.toLowerCase();
      for (const part of parts)
        assert.equal(low.includes(part), false, `${key} ${lang}: ${part}`);
      for (const w of forbidden)
        assert.doesNotMatch(
          text,
          new RegExp(`(?<![\\p{L}\\p{N}])${w}(?![\\p{L}\\p{N}])`, "iu"),
          `${key} ${lang}: ${w}`,
        );
      for (const w of promise)
        assert.equal(low.includes(w), false, `${key} ${lang}: ${w}`);
      if (lang === "ru") assert.doesNotMatch(text, second, key);
    }
  }
  // the rules bite: a text that breaks them is found
  assert.ok(
    wordsOf(
      "one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen",
    ).length > 18,
  );
  assert.match("Ты можешь", second);
});

// The strings that a screen may hold: the texts of the page with the numbers put in, the
// names of the languages, the words of the tenant in the language, the words of the server.
function allowedFor(site, lang) {
  const body = site.body(lang);
  const exact = new Set([
    ...Object.values(LANGUAGE_LABELS),
    body.name,
    body.intro,
    ...SERVER_TEXTS_ALL(lang),
  ]);
  for (const q of body.questions) {
    exact.add(q.title);
    if (q.help) exact.add(q.help);
    if (q.unit) exact.add(q.unit);
    for (const o of q.options ?? []) exact.add(o.label);
  }
  const patterns = PAGE_KEYS.map((key) => {
    const text = PAGE_TEXTS[key][LANGS.indexOf(lang)];
    const source = text
      .split(/(\{[a-z]+\})/u)
      .map((piece) =>
        /^\{[a-z]+\}$/u.test(piece)
          ? "-?\\d+"
          : piece.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"),
      )
      .join("");
    return new RegExp(`^${source}$`, "u");
  });
  return (text) => exact.has(text) || patterns.some((p) => p.test(text));
}
const SERVER_TEXTS_ALL = (lang) =>
  Object.values(SERVER_TEXTS).map((triple) => triple[LANGS.indexOf(lang)]);

test("QP-8b: on every screen, in three languages, on both tenants, every text of the page is a text of the table, a name of a language, a word of the tenant in that language or a word of the server - and nothing else", async (t) => {
  const stranger = allowedFor(up, "ru");
  assert.equal(stranger("A foreign text"), false, "the check bites");
  assert.equal(stranger("Вопрос 3 из 10"), true);
  for (const site of [up, sm]) {
    for (const lang of LANGS) {
      const known = allowedFor(site, lang);
      const found = new Set();
      const look = (page) => {
        for (const text of page.app.textNodes()) found.add(text);
      };
      const where = `${site.id} ${lang}`;
      // loading
      const loading = await loadPage(t, {
        start: false,
        path: `/t/${site.id}/`,
        search: `?lang=${lang}`,
      });
      const hold = loading.net.hold(GET);
      await loading.run();
      assert.equal(loading.screen, "loading");
      look(loading);
      hold.respond({ status: 200, body: site.body(lang) });
      await settle();
      look(loading);
      // the card with the notice and the card with the saved answers
      const stale = JSON.stringify({
        format: 1,
        version: "d".repeat(64),
        lang,
        current: "x",
        answers: { x: "y" },
      });
      const notice = await loadPage(t, {
        path: `/t/${site.id}/`,
        storage: { initial: { [KEY(site.id)]: stale } },
      });
      assert.equal(notice.all('[data-part="notice"]').length, 1);
      look(notice);
      const first = site.plain.questions[0].id;
      const saved = JSON.stringify({
        format: 1,
        version: site.version,
        lang,
        current: first,
        answers: { [first]: site.plain.questions[0].options[0].id },
      });
      const card = await loadPage(t, {
        path: `/t/${site.id}/`,
        storage: { initial: { [KEY(site.id)]: saved } },
      });
      look(card);
      // the questions: every kind, the message of a required question and of a wrong number
      const page = await loadPage(t, {
        path: `/t/${site.id}/`,
        search: `?lang=${lang}`,
      });
      look(page);
      await page.tap("start");
      const rng = makeRng(57100);
      for (
        let guard = 0;
        guard < 30 && page.screen === "question";
        guard += 1
      ) {
        const q = page.currentQuestion(site);
        look(page);
        const last = page.action("show-result") !== null;
        const main = last ? "show-result" : "next";
        if (q.required) {
          await page.tap(main);
          look(page);
        }
        if (q.type === "number") {
          await page.type(page.must("input"), "abc");
          await page.tap(main);
          look(page);
        }
        const value =
          q.type === "single"
            ? rng.pick(q.options).id
            : q.type === "multiple"
              ? [q.options[0].id]
              : q.min + 1;
        await page.answer(value);
        if (last) {
          page.net.on(POST, "network");
          await page.tap(main);
          look(page); // the block under the buttons
          page.net.on(POST, {
            status: 400,
            body: { error: "answers_invalid" },
          });
          await page.tap("retry");
          look(page);
          await page.tap("restart");
          look(page);
          break;
        }
        await page.tap(main);
      }
      // a lost net at the load and at a change of the language
      const lost = await loadPage(t, {
        start: false,
        path: `/t/${site.id}/`,
        search: `?lang=${lang}`,
      });
      lost.net.on(GET, "network");
      await lost.run();
      look(lost);
      const lang2 = LANGS.find((l) => l !== lang);
      const changing = await loadPage(t, {
        path: `/t/${site.id}/`,
        search: `?lang=${lang}`,
      });
      changing.net.on(GET, { status: 500, body: { error: "internal" } });
      await changing.click(changing.langButton(lang2));
      look(changing);
      // the screen of the result
      const done = await loadPage(t, {
        path: `/t/${site.id}/`,
        search: `?lang=${lang}`,
      });
      await done.tap("start");
      await walkForward(done, site, makeRng(57101));
      assert.equal(done.screen, "result");
      look(done);
      assert.ok(found.size > 30, `${where}: ${found.size} texts`);
      const unknown = [...found].filter((text) => !known(text));
      assert.deepEqual(unknown, [], where);
    }
  }
});

test("QP-8c: the card does not carry the old label 'Start' - the main button says 'Take the survey' in each language", async (t) => {
  for (const lang of LANGS) {
    const page = await loadPage(t, { search: `?lang=${lang}` });
    assert.equal(
      page.action("start").text,
      PAGE_TEXTS.card_start[LANGS.indexOf(lang)],
    );
    for (const text of page.app.textNodes())
      assert.notEqual(
        text,
        ["Начать", "Start", "Бастау"][LANGS.indexOf(lang)],
        lang,
      );
  }
  const ru = await loadPage(t);
  assert.equal(ru.action("start").text, "Пройти опрос");
  assert.doesNotMatch(ru.text, /Начать(?! заново)/u);
});

// ---------------------------------------------------------------------- QP-9

const LANG_ROWS = [
  // [label, ?lang, stored language, site, language of the page, language of the request]
  ["?lang=kk, nothing stored", "?lang=kk", null, up, "kk", "kk"],
  ["no ?lang, nothing stored", "", null, up, "ru", "ru"],
  ["no ?lang, 'en' stored", "", "en", up, "en", "en"],
  ["?lang=de over 'kk' stored", "?lang=de", "kk", up, "kk", "kk"],
  ["?lang=KK (capitals)", "?lang=KK", null, up, "ru", "ru"],
  ["?lang=kk over 'en' stored", "?lang=kk", "en", up, "kk", "kk"],
  [
    "?lang=kk, a file of one language",
    "?lang=kk",
    null,
    legacySite(UP),
    "ru",
    "kk",
  ],
];

test("QP-9a: the choice of the language - ?lang= in the address, then the stored language, then Russian; a value outside the three is as none, capitals count; for a file of one language the answer of the server decides; the request goes with the language chosen and the address is not changed by the page", async (t) => {
  for (const [label, search, stored, site, expected, requested] of LANG_ROWS) {
    const initial =
      stored === null
        ? {}
        : { [KEY(site.id)]: savedValue(site, { lang: stored }) };
    const page = await loadPage(t, {
      sites: [site],
      search,
      storage: { initial },
    });
    assert.equal(page.lang, expected, label);
    assert.equal(page.net.gets[0].lang, requested, label);
    assert.equal(page.net.gets.length, 1, `${label}: no second request`);
    assert.equal(
      page.part("gives").text,
      PAGE_TEXTS.card_gives[LANGS.indexOf(expected)],
      label,
    );
    assert.equal(
      page.part("title").text,
      say(site.plain.name, expected),
      label,
    );
    assert.equal(
      page.loc.search,
      search,
      `${label}: the address is not touched`,
    );
    assert.equal(page.replaces.length, 0, label);
    assert.equal(page.title, say(site.plain.name, expected), label);
  }
});

test("QP-9b: the switcher - three buttons 'Русский', 'Қазақша', 'English' of type button, each with the lang of its language, aria-current only on the current one, the group named in the language of the page; no switcher for a file of one language", async (t) => {
  for (const lang of LANGS) {
    const page = await loadPage(t, { search: `?lang=${lang}` });
    assert.deepEqual(
      page.langButtons.map((b) => [
        b.text,
        b.attr("type"),
        b.attr("lang"),
        b.attr("aria-current"),
      ]),
      LANGS.map((l) => [
        LANGUAGE_LABELS[l],
        "button",
        l,
        l === lang ? "true" : null,
      ]),
    );
    const group = page.part("languages");
    assert.equal(group.attr("role"), "group");
    assert.equal(group.attr("aria-label"), SWITCHER_LABEL[lang]);
  }
  const legacy = await loadPage(t, {
    sites: [legacySite(UP)],
    search: "?lang=kk",
  });
  assert.equal(legacy.all('[data-part="languages"]').length, 0);
  assert.equal(legacy.langButtons.length, 0);
  assert.equal(legacy.lang, "ru");
});

test("QP-9c: a change of the language on the third question - the same question, the same answers, the same K and N, no reload (the same document and the same page), the address gets ?lang= with the other parameters and the fragment kept and no new entry in the history, one request of the questionnaire, the language in the stored value", async (t) => {
  const page = await begin(t, { search: "?a=1&lang=ru", hash: "#frag" });
  await page.answer("retail");
  await page.tap("next");
  await page.answer(120);
  await page.tap("next");
  await page.answer("few-places");
  const doc = page.doc;
  const root = page.app;
  const before = page.progress;
  assert.equal(before.text, "Вопрос 3 из 10");
  const gets = page.net.gets.length;
  await page.click(page.langButton("kk"));
  same(page.doc, doc);
  same(page.app, root);
  assert.equal(page.net.gets.length, gets + 1);
  assert.equal(page.net.gets[gets].lang, "kk");
  assert.equal(page.lang, "kk");
  assert.equal(page.qTitle, titleOf(up, "places", "kk"));
  assert.equal(page.chosen(), "few-places");
  const after = page.progress;
  assert.deepEqual([after.k, after.n], [before.k, before.n]);
  assert.equal(after.text, "Сұрақ 3 / 10");
  assert.equal(page.langButton("kk").attr("aria-current"), "true");
  assert.equal(page.langButton("ru").attr("aria-current"), null);
  assert.equal(page.title, say(up.plain.name, "kk"));
  assert.equal(page.part("title").text, say(up.plain.name, "kk"));
  assert.equal(page.replaces.length, 1);
  assert.equal(page.replaces[0].url, `/t/${UP}/?a=1&lang=kk#frag`);
  assert.equal(page.loc.hash, "#frag");
  assert.deepEqual(page.misuse, [], "no reload, no assign, no push");
  assert.equal(page.stored(UP).lang, "kk");
  assert.deepEqual(page.stored(UP).answers, {
    business: "retail",
    items: 120,
    places: "few-places",
  });
  assert.equal(page.stored(UP).current, "places");
  same(page.active, page.langButton("kk"));
  // and back, from the card too
  await page.click(page.langButton("en"));
  assert.equal(page.qTitle, titleOf(up, "places", "en"));
  assert.equal(page.replaces[1].url, `/t/${UP}/?a=1&lang=en#frag`);
});

test("QP-9d: an answer given in Russian is chosen after the change to Kazakh; a text in the field of a number that is not right stays as it was typed", async (t) => {
  const page = await begin(t);
  await page.answer("wholesale");
  await page.click(page.langButton("kk"));
  assert.equal(page.chosen(), "wholesale");
  assert.equal(
    page.inputs.find((i) => i.checked).parent.text,
    say(questionOf(up, "business").options[1].label, "kk"),
  );
  await page.tap("next");
  await page.type(page.must("input"), "2.5");
  await page.tap("next");
  assert.equal(
    page.part("q-error").text,
    "1 мен 100000 арасындағы бүтін санды енгізіңіз.",
  );
  await page.click(page.langButton("en"));
  assert.equal(page.must("input").value, "2.5");
  assert.equal(
    page.part("q-error").text,
    "Enter a whole number from 1 to 100000.",
  );
  assert.equal(page.must("input").attr("aria-invalid"), "true");
  assert.equal(page.qTitle, titleOf(up, "items", "en"));
  // a message that is gone does not come back at a change of the language: (a) the
  // answer was corrected after a refused 'Next'; (b) the visitor left the question by
  // 'Back' - the message of the question left is not drawn on the question it opened
  const fresh = await begin(t);
  await fresh.tap("next");
  assert.equal(fresh.part("q-error").text, PAGE_TEXTS.quiz_required[0]);
  await fresh.answer("retail");
  assert.equal(fresh.part("q-error").text, "");
  await fresh.click(fresh.langButton("kk"));
  assert.equal(fresh.lang, "kk");
  assert.equal(fresh.part("q-error").text, "", "(a) no message after the fix");
  const left = await begin(t);
  await left.answer("retail");
  await left.tap("next");
  await left.type(left.must("input"), "2.5");
  await left.tap("next");
  assert.equal(
    left.part("q-error").text,
    "Введите целое число от 1 до 100000.",
  );
  await left.tap("back");
  assert.equal(left.qTitle, titleOf(up, "business"));
  assert.equal(left.part("q-error").text, "");
  await left.click(left.langButton("kk"));
  assert.equal(left.qTitle, titleOf(up, "business", "kk"));
  assert.equal(
    left.part("q-error").text,
    "",
    "(b) no message of the other question",
  );
  assert.equal(left.part("fieldset").attr("aria-describedby"), null);
  const required = await begin(t);
  await required.answer("retail");
  await required.tap("next");
  await required.tap("next");
  assert.equal(required.part("q-error").text, PAGE_TEXTS.quiz_required[0]);
  await required.tap("back");
  await required.click(required.langButton("en"));
  assert.equal(
    required.part("q-error").text,
    "",
    "(b) the same for a required one",
  );
});

test("QP-9e: two presses in a row, the answers come in the other order - the page is on the language of the last press, whichever answer comes first", async (t) => {
  for (const order of ["last first", "first first"]) {
    const page = await begin(t);
    await page.answer("retail");
    const first = page.net.hold((r) => GET(r) && r.lang === "kk");
    const second = page.net.hold((r) => GET(r) && r.lang === "en");
    page.click(page.langButton("kk"));
    page.click(page.langButton("en"));
    await settle();
    assert.ok(first.request && second.request, order);
    const bodies = { kk: up.body("kk"), en: up.body("en") };
    const answers =
      order === "last first"
        ? [
            [second, "en"],
            [first, "kk"],
          ]
        : [
            [first, "kk"],
            [second, "en"],
          ];
    for (const [hold, lang] of answers) {
      hold.respond({ status: 200, body: bodies[lang] });
      await settle();
    }
    assert.equal(page.lang, "en", order);
    assert.equal(page.langButton("en").attr("aria-current"), "true", order);
    assert.equal(page.langButton("kk").attr("aria-current"), null, order);
    assert.equal(page.qTitle, titleOf(up, "business", "en"), order);
    assert.equal(page.replaces.length, 1, order);
    assert.equal(page.loc.search, "?lang=en", order);
    assert.equal(page.stored(UP).lang, "en", order);
  }
});

test("QP-9f: another version of the questionnaire in the new language - the saved answers and the place are cleared, the card stands with the notice, the header stays; the stored value holds the new version and the language", async (t) => {
  const page = await begin(t);
  await page.answer("retail");
  await page.tap("next");
  await page.answer(120);
  const other = "9".repeat(64);
  page.net.on((r) => GET(r) && r.lang === "kk", {
    status: 200,
    body: { ...up.body("kk"), version: other },
  });
  await page.click(page.langButton("kk"));
  assert.equal(page.screen, "card");
  assert.equal(page.part("notice").text, PAGE_TEXTS.card_changed[1]);
  assert.equal(page.lang, "kk");
  assert.deepEqual(page.stored(UP), {
    format: 1,
    version: other,
    lang: "kk",
    current: null,
    answers: {},
  });
  assert.equal(page.all('[data-action="continue"]').length, 0);
  same(page.active, page.langButton("kk"));
  // each clause of "something to lose" alone (design 5.2, B1 and L1): answers with the
  // place on the first question; a place beyond the first question with no answers
  const answersOnly = await begin(t);
  await answersOnly.answer("retail");
  assert.equal(answersOnly.stored(UP).current, "business");
  answersOnly.net.on((r) => GET(r) && r.lang === "kk", {
    status: 200,
    body: { ...up.body("kk"), version: other },
  });
  await answersOnly.click(answersOnly.langButton("kk"));
  assert.equal(answersOnly.screen, "card");
  assert.equal(answersOnly.part("notice").text, PAGE_TEXTS.card_changed[1]);
  assert.equal(answersOnly.lang, "kk");
  assert.deepEqual(answersOnly.stored(UP), {
    format: 1,
    version: other,
    lang: "kk",
    current: null,
    answers: {},
  });
  const optionalFirst = customSite({
    id: "optional-first",
    languages: ["ru", "kk"],
    questions: [
      single("a", "A", ["x", "y"], { required: false }),
      single("b", "B", ["x", "y"]),
    ],
  });
  const placeOnly = await begin(t, { sites: [optionalFirst] });
  await placeOnly.tap("next");
  assert.equal(placeOnly.qTitle, "B");
  assert.deepEqual(placeOnly.stored("optional-first").answers, {});
  placeOnly.net.on((r) => GET(r) && r.lang === "kk", {
    status: 200,
    body: { ...optionalFirst.body("kk"), version: other },
  });
  await placeOnly.click(placeOnly.langButton("kk"));
  assert.equal(placeOnly.screen, "card");
  assert.equal(placeOnly.part("notice").text, PAGE_TEXTS.card_changed[1]);
  assert.equal(placeOnly.lang, "kk");
  assert.deepEqual(placeOnly.stored("optional-first"), {
    format: 1,
    version: other,
    lang: "kk",
    current: null,
    answers: {},
  });
  // nothing to lose (no answers, the place is the first question): no notice
  const nothing = await begin(t, { sites: [optionalFirst] });
  nothing.net.on((r) => GET(r) && r.lang === "kk", {
    status: 200,
    body: { ...optionalFirst.body("kk"), version: other },
  });
  await nothing.click(nothing.langButton("kk"));
  assert.equal(nothing.screen, "card");
  assert.equal(nothing.all('[data-part="notice"]').length, 0);
  assert.equal(nothing.lang, "kk");
  // "the first question" is that of the file the visitor has been on, not that of the
  // new one: the other version names another first question, and a visitor on the old
  // first question with no answers has nothing to lose
  const renamed = {
    ...optionalFirst.body("kk"),
    version: other,
    questions: [
      single("a2", "A2", ["x", "y"], { required: false }),
      single("b", "B", ["x", "y"]),
    ],
  };
  const moved = await begin(t, { sites: [optionalFirst] });
  assert.equal(moved.qTitle, "A");
  moved.net.on((r) => GET(r) && r.lang === "kk", {
    status: 200,
    body: renamed,
  });
  await moved.click(moved.langButton("kk"));
  assert.equal(moved.screen, "card");
  assert.equal(moved.lang, "kk");
  assert.equal(moved.all('[data-part="notice"]').length, 0, "nothing to lose");
  assert.deepEqual(moved.stored("optional-first"), {
    format: 1,
    version: other,
    lang: "kk",
    current: null,
    answers: {},
  });
  // and a visitor who has moved on from the old first question has something to lose,
  // whatever the new file calls its first question
  const gone = await begin(t, { sites: [optionalFirst] });
  await gone.tap("next");
  assert.equal(gone.qTitle, "B");
  gone.net.on((r) => GET(r) && r.lang === "kk", {
    status: 200,
    body: {
      ...renamed,
      questions: [renamed.questions[1], renamed.questions[0]],
    },
  });
  await gone.click(gone.langButton("kk"));
  assert.equal(gone.screen, "card");
  assert.ok(gone.part("notice"), "the notice stands");
  assert.equal(gone.part("notice").text, PAGE_TEXTS.card_changed[1]);
});

test("QP-9f2: after the change of the language that brings another version of the questionnaire, the new language is the current one in the header: aria-current on its button and the group named in that language", async (t) => {
  const page = await begin(t);
  await page.answer("retail");
  page.net.on((r) => GET(r) && r.lang === "kk", {
    status: 200,
    body: { ...up.body("kk"), version: "9".repeat(64) },
  });
  await page.click(page.langButton("kk"));
  assert.equal(page.lang, "kk");
  assert.deepEqual(
    page.langButtons.map((b) => [b.attr("lang"), b.attr("aria-current")]),
    [
      ["ru", null],
      ["kk", "true"],
      ["en", null],
    ],
  );
  assert.equal(page.part("languages").attr("aria-label"), SWITCHER_LABEL.kk);
});

test("QP-9g: the button of the current language does nothing; a press while the result is asked for does nothing either - no request, no change", async (t) => {
  const page = await begin(t);
  await page.answer("retail");
  const gets = page.net.gets.length;
  const snapshot = page.storage.snapshot();
  await page.click(page.langButton("ru"));
  assert.equal(page.net.gets.length, gets);
  assert.deepEqual(page.storage.snapshot(), snapshot);
  assert.equal(page.replaces.length, 0);
  // during the request of the result
  const run = await begin(t);
  await walkForward(run, up, makeRng(57110), {
    omitRate: 0,
    stopAtResult: true,
  });
  const hold = run.net.hold(POST);
  await run.tap("show-result");
  const getsNow = run.net.gets.length;
  const stored = run.storage.snapshot();
  await run.click(run.langButton("kk"));
  assert.equal(run.net.gets.length, getsNow, "no request");
  assert.equal(run.lang, "ru");
  assert.equal(run.langButton("ru").attr("aria-current"), "true");
  assert.equal(run.replaces.length, 0);
  assert.deepEqual(run.storage.snapshot(), stored);
  assert.equal(run.net.posts[0].lang, "ru");
  hold.respond({
    status: 200,
    body: {
      clear_leader: true,
      recommended: [],
      no_match_text: null,
      hypotheses: [],
    },
  });
  await settle();
  assert.equal(run.screen, "result");
  assert.equal(run.lang, "ru");
  // the next press works as usual
  await run.click(run.langButton("kk"));
  assert.equal(run.lang, "kk");
});

test("QP-9h: a change of the language on the screen of the result - the same answers go again with the new language and the screen is drawn again; if that fails, the block stands under the header and the page, the address and the storage keep the old language", async (t) => {
  const page = await begin(t);
  await walkForward(page, up, makeRng(57120), { omitRate: 0 });
  assert.equal(page.screen, "result");
  const first = page.net.posts[0];
  await page.click(page.langButton("kk"));
  assert.equal(page.screen, "result");
  assert.equal(page.net.posts.length, 2);
  assert.equal(page.net.posts[1].lang, "kk");
  assert.deepEqual(page.net.posts[1].body, first.body);
  assert.equal(page.lang, "kk");
  assert.equal(page.part("result-title").text, PAGE_TEXTS.result_soon[1]);
  assert.equal(page.loc.search, "?lang=kk");
  assert.equal(page.stored(UP).lang, "kk");
  same(
    page.active,
    page.langButton("kk"),
    "the focus stays on the pressed button",
  );
  // a failure of the second request
  const second = await begin(t);
  await walkForward(second, up, makeRng(57120), { omitRate: 0 });
  const snapshot = second.storage.snapshot();
  second.net.on((r) => POST(r) && r.lang === "kk", "network");
  await second.click(second.langButton("kk"));
  assert.equal(second.screen, "result");
  assert.equal(second.part("net").attr("data-kind"), "lang");
  assert.equal(
    second.must('[data-part="head-net-slot"] [data-part="net"]') !== null,
    true,
  );
  assert.equal(second.lang, "ru");
  assert.equal(second.langButton("ru").attr("aria-current"), "true");
  assert.equal(second.part("result-title").text, PAGE_TEXTS.result_soon[0]);
  assert.equal(second.replaces.length, 0);
  assert.deepEqual(second.storage.snapshot(), snapshot);
  await second.tap("retry");
  assert.equal(second.lang, "kk");
  assert.equal(second.part("result-title").text, PAGE_TEXTS.result_soon[1]);
  same(
    second.active,
    second.langButton("kk"),
    "the focus is on the button of kk",
  );
  // two presses on the screen of the result (kk, then en): the requests of the result go
  // out for both, and their answers come in either order - the last press wins (rule L1)
  const resultBody = {
    clear_leader: true,
    recommended: [],
    no_match_text: null,
    hypotheses: [],
  };
  for (const order of ["last first", "first first"]) {
    const race = await begin(t);
    await walkForward(race, up, makeRng(57121), { omitRate: 0 });
    assert.equal(race.screen, "result", order);
    const kk = race.net.hold((r) => POST(r) && r.lang === "kk");
    const en = race.net.hold((r) => POST(r) && r.lang === "en");
    await race.click(race.langButton("kk"));
    assert.ok(kk.request, `${order}: the request of the result for kk is out`);
    await race.click(race.langButton("en"));
    assert.ok(en.request, `${order}: the request of the result for en is out`);
    const sequence = order === "last first" ? [en, kk] : [kk, en];
    for (const hold of sequence) {
      hold.respond({ status: 200, body: resultBody });
      await settle();
    }
    assert.equal(race.screen, "result", order);
    assert.equal(race.lang, "en", order);
    assert.equal(race.langButton("en").attr("aria-current"), "true", order);
    assert.equal(race.langButton("kk").attr("aria-current"), null, order);
    assert.equal(race.langButton("ru").attr("aria-current"), null, order);
    assert.equal(race.title, say(up.plain.name, "en"), order);
    assert.equal(race.part("result-title").text, PAGE_TEXTS.result_soon[2]);
    assert.equal(
      race.replaces.length,
      1,
      `${order}: one change of the address`,
    );
    assert.equal(race.loc.search, "?lang=en", order);
    assert.equal(race.stored(UP).lang, "en", order);
    assert.equal(race.all('[data-part="net"]').length, 0, order);
  }
});

test("QP-9i: a press of a language before 'Show the result' whose answer has not come when the result is asked for is dropped - the request, the page and the result stay in the old language; nothing is changed by the late answer (the page, the address, the document, the storage); the next press works", async (t) => {
  const page = await begin(t);
  await walkForward(page, up, makeRng(57130), {
    omitRate: 0,
    stopAtResult: true,
  });
  const late = page.net.hold((r) => GET(r) && r.lang === "kk");
  await page.click(page.langButton("kk"));
  assert.ok(late.request, "the request of the questionnaire is on its way");
  const snapshot = page.storage.snapshot();
  await page.tap("show-result");
  assert.equal(page.net.posts.length, 1);
  assert.equal(
    page.net.posts[0].lang,
    "ru",
    "the result is asked for in the old language",
  );
  assert.equal(page.screen, "result");
  late.respond({ status: 200, body: up.body("kk") });
  await settle();
  assert.equal(page.lang, "ru");
  assert.equal(page.langButton("ru").attr("aria-current"), "true");
  assert.equal(page.langButton("kk").attr("aria-current"), null);
  assert.equal(page.title, say(up.plain.name, "ru"));
  assert.equal(page.part("result-title").text, PAGE_TEXTS.result_soon[0]);
  assert.equal(page.replaces.length, 0);
  assert.equal(page.loc.search, "");
  assert.deepEqual(page.storage.snapshot(), snapshot);
  assert.equal(page.net.posts.length, 1, "no second request");
  // the next press works as usual
  await page.click(page.langButton("kk"));
  assert.equal(page.lang, "kk");
  assert.equal(page.net.posts[1].lang, "kk");
  assert.equal(page.part("result-title").text, PAGE_TEXTS.result_soon[1]);
});

test("QP-9j: a press of a language on the screen of the result followed by 'Back' or 'Start over' before the change is finished is dropped - no request of the result goes if the questionnaire has not come, a request that is out is dropped on return; the page, the address, the document, the storage and the screen stay; a stale result does not open over newer answers; the next press works", async (t) => {
  // (1) the questionnaire has not come when the visitor goes back
  const page = await begin(t);
  await walkForward(page, up, makeRng(57140), { omitRate: 0 });
  const lateGet = page.net.hold((r) => GET(r) && r.lang === "kk");
  await page.click(page.langButton("kk"));
  assert.ok(lateGet.request);
  await page.tap("edit");
  assert.equal(page.screen, "question");
  const question = page.qTitle;
  const posts = page.net.posts.length;
  const snapshot = page.storage.snapshot();
  const focus = page.active;
  lateGet.respond({ status: 200, body: up.body("kk") });
  await settle();
  assert.equal(page.net.posts.length, posts, "no request of the result");
  assert.equal(page.screen, "question");
  assert.equal(page.qTitle, question);
  assert.equal(page.lang, "ru");
  assert.equal(page.langButton("ru").attr("aria-current"), "true");
  assert.equal(page.replaces.length, 0);
  assert.deepEqual(page.storage.snapshot(), snapshot);
  same(page.active, focus, "the focus is not taken back");
  // (2) the request of the result is out when the visitor starts over
  const again = await begin(t);
  await walkForward(again, up, makeRng(57141), { omitRate: 0 });
  const latePost = again.net.hold((r) => POST(r) && r.lang === "kk");
  await again.click(again.langButton("kk"));
  assert.ok(latePost.request, "the second request is on its way");
  await again.tap("restart");
  assert.equal(again.screen, "question");
  const stored = again.storage.snapshot();
  const writes = again.storage.sets().length;
  latePost.respond({
    status: 200,
    body: {
      clear_leader: true,
      recommended: [],
      no_match_text: null,
      hypotheses: [],
    },
  });
  await settle();
  assert.equal(again.screen, "question", "the result does not come back");
  assert.equal(again.qTitle, titleOf(up, "business"));
  assert.equal(again.lang, "ru");
  assert.equal(again.langButton("ru").attr("aria-current"), "true");
  assert.equal(again.replaces.length, 0);
  assert.deepEqual(again.storage.snapshot(), stored);
  assert.equal(again.storage.sets().length, writes);
  await again.click(again.langButton("kk"));
  assert.equal(again.lang, "kk");
  // (3) back, a new answer, the result again - the late answer of the old press is dropped
  const third = await begin(t);
  await walkForward(third, up, makeRng(57142), { omitRate: 0 });
  const stale = third.net.hold((r) => GET(r) && r.lang === "kk");
  await third.click(third.langButton("kk"));
  await third.tap("edit");
  const lastQuestion = third.currentQuestion(up);
  const other = lastQuestion.options.find((o) => o.id !== third.chosen());
  await third.answer(other.id);
  await third.tap("show-result");
  assert.equal(third.screen, "result");
  const postsBefore = third.net.posts.length;
  const resultText = third.text;
  stale.respond({ status: 200, body: up.body("kk") });
  await settle();
  assert.equal(third.screen, "result");
  assert.equal(third.lang, "ru");
  assert.equal(third.text, resultText);
  assert.equal(third.net.posts.length, postsBefore);
  assert.equal(
    third.net.posts[postsBefore - 1].body.answers[lastQuestion.id],
    other.id,
  );
  assert.equal(third.replaces.length, 0);
});

// QP-9k, QP-9l: a change of the language begun on the screen of the result and left by
// 'Back' or 'Start over' before the answer comes (decisions/0078, item 11; design L4).
// The visitor leaving the screen wins over an answer with another version and over a
// failure. Both ways out are tried; the page must stay where the visitor put it.
const LEAVES = [
  ["Back", "edit"],
  ["Start over", "restart"],
];

// The result screen, a press on Kazakh whose questionnaire is held, then the way out.
// Returns what the page shows when the visitor has left, taken before the late answer.
async function leaveDuringChange(t, seed, action) {
  const page = await begin(t);
  await walkForward(page, up, makeRng(seed), { omitRate: 0 });
  assert.equal(page.screen, "result");
  const late = page.net.hold((r) => GET(r) && r.lang === "kk");
  await page.click(page.langButton("kk"));
  assert.ok(late.request, "the request of the questionnaire is on its way");
  await page.tap(action);
  assert.equal(page.screen, "question");
  return {
    page,
    late,
    before: {
      screen: page.screen,
      question: page.qTitle,
      lang: page.lang,
      title: page.title,
      search: page.loc.search,
      hash: page.loc.hash,
      replaces: page.replaces.length,
      stored: page.storage.snapshot(),
      writes: page.storage.sets().length,
      removes: page.storage.removes().length,
      gets: page.net.gets.length,
      posts: page.net.posts.length,
      current: page.langButtons.map((b) => [
        b.attr("lang"),
        b.attr("aria-current"),
      ]),
    },
  };
}

// Everything that must be as it was when the late answer has been handled.
function assertLeftAlone(page, before, where) {
  assert.equal(page.screen, before.screen, where);
  assert.equal(page.qTitle, before.question, where);
  assert.equal(page.lang, "ru", where);
  assert.equal(page.lang, before.lang, where);
  assert.equal(page.title, before.title, where);
  assert.equal(page.loc.search, before.search, where);
  assert.equal(page.loc.hash, before.hash, where);
  assert.equal(page.replaces.length, before.replaces, where);
  assert.deepEqual(page.storage.snapshot(), before.stored, where);
  assert.equal(page.storage.sets().length, before.writes, where);
  assert.equal(page.storage.removes().length, before.removes, where);
  assert.equal(
    page.net.gets.length,
    before.gets,
    `${where}: no new questionnaire request`,
  );
  assert.equal(
    page.net.posts.length,
    before.posts,
    `${where}: no request of the result`,
  );
  assert.equal(
    page.all('[data-part="notice"]').length,
    0,
    `${where}: no notice`,
  );
  assert.equal(
    page.all('[data-part="net"]').length,
    0,
    `${where}: no block of the net`,
  );
  assert.equal(
    page.all('[data-part="head-net-slot"] [data-part="net"]').length,
    0,
    where,
  );
  assert.deepEqual(
    page.langButtons.map((b) => [b.attr("lang"), b.attr("aria-current")]),
    before.current,
    where,
  );
  assert.equal(page.langButton("ru").attr("aria-current"), "true", where);
  assert.equal(page.langButton("kk").attr("aria-current"), null, where);
}

test("QP-9k: a language change begun on the screen of the result, left by 'Back' or 'Start over' before the answer comes, and the answer carries another version - the screen stays, the language, address, document, storage and its write log stay, no card with a notice, no new request, the old language stays marked in the header", async (t) => {
  let seed = 57160;
  for (const [name, action] of LEAVES) {
    const { page, late, before } = await leaveDuringChange(t, seed, action);
    seed += 1;
    late.respond({
      status: 200,
      body: { ...up.body("kk"), version: "9".repeat(64) },
    });
    await settle();
    assertLeftAlone(page, before, name);
    assert.equal(page.all('[data-action="continue"]').length, 0, name);
    // the next press works as usual and brings the new version in the normal way
    page.net.on((r) => GET(r) && r.lang === "kk", {
      status: 200,
      body: { ...up.body("kk"), version: "9".repeat(64) },
    });
    await page.click(page.langButton("kk"));
    assert.equal(page.lang, "kk", name);
    assert.equal(page.screen, "card", name);
    // answers are kept after 'Back' and cleared by 'Start over': only the first shows the notice
    if (action === "edit")
      assert.equal(page.part("notice").text, PAGE_TEXTS.card_changed[1], name);
    else assert.equal(page.all('[data-part="notice"]').length, 0, name);
  }
});

test("QP-9l: a language change begun on the screen of the result, left by 'Back' or 'Start over' before the answer comes, and the answer is a failure (status 500, a network error) - the same state as before, and no block of the net under the header", async (t) => {
  const failures = [
    ["status 500", { status: 500, body: { error: "internal" } }],
    ["network error", "network"],
  ];
  let seed = 57170;
  for (const [name, action] of LEAVES) {
    for (const [kind, failure] of failures) {
      const where = `${name}, ${kind}`;
      const { page, late, before } = await leaveDuringChange(t, seed, action);
      seed += 1;
      late.respond(failure);
      await settle();
      assertLeftAlone(page, before, where);
      // the next press works as usual
      await page.click(page.langButton("kk"));
      assert.equal(page.lang, "kk", where);
    }
  }
});

// ---------------------------------------------------------------------- QP-11

test("QP-11a: the card on both tenants in three languages - its text is only the name, the introduction, what you get, the call, the number of questions, the names of the languages and one button 'Take the survey'; the name comes first in the order of reading; there is exactly one start button", async (t) => {
  for (const site of [up, sm]) {
    for (const lang of LANGS) {
      const page = await loadPage(t, {
        path: `/t/${site.id}/`,
        search: `?lang=${lang}`,
      });
      const i = LANGS.indexOf(lang);
      const min = plainCount(site);
      const max = site.plain.questions.length;
      const where = `${site.id} ${lang}`;
      assert.deepEqual(
        page.panel.textNodes(),
        [
          say(site.plain.name, lang),
          ...LANGS.map((l) => LANGUAGE_LABELS[l]),
          say(site.plain.intro, lang),
          PAGE_TEXTS.card_gives[i],
          PAGE_TEXTS.card_ask[i],
          pageText("card_count", lang, { min, max }),
          PAGE_TEXTS.card_start[i],
        ],
        where,
      );
      assert.equal(
        page.panel.textNodes()[0],
        say(site.plain.name, lang),
        where,
      );
      assert.equal(page.all('[data-action="start"]').length, 1, where);
      assert.equal(page.all("button").length, 4, where);
      assert.equal(page.all("input").length, 0, where);
    }
  }
});

test("QP-11b: the button of the card opens the first question and makes no request except the load of the questionnaire", async (t) => {
  for (const site of [up, sm]) {
    const page = await loadPage(t, { path: `/t/${site.id}/` });
    assert.equal(page.net.requests.length, 1);
    await page.tap("start");
    assert.equal(page.net.requests.length, 1);
    assert.equal(page.qTitle, say(site.plain.questions[0].title, "ru"));
  }
});

test("QP-11c: no blocking window on any screen - no dialog, role dialog or aria-modal in the tree, no alert, confirm or prompt called", async (t) => {
  const page = await loadPage(t);
  const windows = () =>
    page.doc.html.all('dialog, [role="dialog"], [aria-modal]').length;
  assert.equal(windows(), 0);
  await page.tap("start");
  assert.equal(windows(), 0);
  await page.tap("next"); // the message
  assert.equal(windows(), 0);
  await walkForward(page, up, makeRng(57150), { omitRate: 0 });
  assert.equal(page.screen, "result");
  assert.equal(windows(), 0);
  await page.tap("restart"); // no confirmation
  assert.equal(page.screen, "question");
  assert.equal(windows(), 0);
  const lost = await loadPage(t, { start: false });
  lost.net.on(GET, "network");
  await lost.run();
  assert.equal(
    lost.doc.html.all('dialog, [role="dialog"], [aria-modal]').length,
    0,
  );
  for (const p of [page, lost]) assert.deepEqual(p.dialogs, []);
});

test("QP-11d: the card with the notice and the card with saved answers - the parts stand in the order of the design: the notice, the introduction, what you get, the call, the number, then the buttons ('Take the survey' after a notice, 'Continue' and 'Start over' with saved answers)", async (t) => {
  const stale = JSON.stringify({
    format: 1,
    version: "a".repeat(64),
    lang: "ru",
    current: "items",
    answers: { business: "retail" },
  });
  const notice = await loadPage(t, {
    storage: { initial: { [KEY(UP)]: stale } },
  });
  assert.deepEqual(
    notice
      .all('[data-part="panel"] > [data-part]')
      .map((n) => n.attr("data-part")),
    ["head", "notice", "intro", "gives", "ask", "count", "actions"],
  );
  assert.deepEqual(
    notice.part("actions").elements.map((n) => n.attr("data-part")),
    ["start"],
  );
  const saved = await loadPage(t, {
    storage: {
      initial: {
        [KEY(UP)]: savedValue(up, {
          current: "items",
          answers: { business: "retail" },
        }),
      },
    },
  });
  assert.deepEqual(
    saved
      .all('[data-part="panel"] > [data-part]')
      .map((n) => n.attr("data-part")),
    ["head", "intro", "gives", "ask", "count", "actions"],
  );
  assert.deepEqual(
    saved.part("actions").elements.map((n) => n.attr("data-part")),
    ["continue", "restart"],
  );
});
