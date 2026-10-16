// PN: the header, the journal, the task panel, the legend and the card
// (design 10.2; REQ-007 criteria 5, 6, 9, 14, 15; REQ-001 criteria 4, 6, 7).
// The page is built by createApp on a DOM parsed from index.html.
import assert from "node:assert/strict";
import { test } from "node:test";
import { buildModel } from "../src/pixel-office/public/model.js";
import { buildLayout } from "../src/pixel-office/public/layout.js";
import { STALE_AFTER_MS } from "../src/pixel-office/public/schema.js";
import {
  ageText,
  fmtDateTime,
  fmtTime,
} from "../src/pixel-office/public/format.js";
import {
  EMPTY_HINT,
  FILTER_LABELS,
  HEADER_BADGE,
  JOURNAL_TITLE,
  LIVE,
  MAIN_ROW,
  NOSCRIPT,
  OFFICE_SCROLL_LABEL,
  NOT_FROM_HOOKS,
  NO_CONNECTION,
  NO_DATA,
  NOW_EMPTY,
  PAUSE,
  ROLE_UNKNOWN,
  SPEED_LABELS,
  STATE_LABELS,
  TASKS_TITLE,
} from "../src/pixel-office/public/texts.js";
import {
  FakeDocument,
  HELPERS_URL,
  NOW,
  T0,
  at,
  entryOf,
  indexHtml,
  journal,
  makePage,
  runWithTz,
  sandbox,
  settle,
  withText,
} from "./pixel-office-helpers.js";
import fs from "node:fs";
import path from "node:path";
import { buildHistory } from "../src/pixel-office/public/history.js";
import * as TX from "../src/pixel-office/public/texts.js";
import {
  PUBLIC,
  cssDecls,
  historyDom,
  historyRowOf,
  historyRows,
  parseCss,
} from "./pixel-office-helpers.js";

// "Работа" by the text of criterion 14 REQ-007, not by the constant of the code.
const CRITERION_WORK = [
  "UserPromptSubmit",
  "Stop",
  "PostToolUse",
  "SubagentStart",
  "SubagentStop",
];
const IMG = "<img src=x onerror=alert(1)>";

function launch(j, session, id, role, extra = {}) {
  j.post(session, `tu-${id}`, id, {
    subagentType: role,
    description: extra.description,
  });
  return j.subStart(session, id, role);
}

async function loaded(entries, starts = [], o = {}) {
  const page = makePage({ entries: [...entries], starts, ...o });
  await page.start();
  return page;
}

const linkState = (page) => page.el("link").dataset.state;

// ------------------------------------------------------------------ PN-01

test("PN-01: the link block - none before the first poll, live after a good one, down after every kind of failure; a first misfit does not change the state, a second does; the badge is HEADER_BADGE in all states", async () => {
  const j = journal();
  j.sessionStart("S1");
  const page = makePage({ entries: [...j.entries] });
  page.server.mode = "hang";
  await page.start();
  assert.equal(linkState(page), "none");
  assert.equal(page.text("link-status"), "");
  assert.equal(page.text("link-status").includes(LIVE), false);
  assert.equal(page.text("source-badge"), HEADER_BADGE);
  await page.tick(3000);
  assert.equal(linkState(page), "down", "the first load did not succeed");
  assert.equal(page.text("link-status"), NO_CONNECTION);
  page.server.mode = "ok";
  await page.tick(2000);
  await page.tick(2000);
  assert.equal(linkState(page), "live");
  assert.equal(page.text("link-status"), LIVE);
  assert.equal(page.text("source-badge"), HEADER_BADGE);
  for (const mode of ["fail", "status500", "notjson", "badshape"]) {
    page.server.mode = "ok";
    await page.tick(2000);
    assert.equal(linkState(page), "live", `before ${mode}`);
    page.server.mode = mode;
    await page.tick(2000);
    assert.equal(linkState(page), "down", mode);
    assert.equal(page.text("link-status"), NO_CONNECTION, mode);
    assert.equal(page.text("source-badge"), HEADER_BADGE);
  }
  page.server.mode = "hang";
  await page.tick(2000);
  await page.tick(3000);
  assert.equal(linkState(page), "down", "an aborted request");
  // misfits
  page.server.mode = "ok";
  await page.tick(2000);
  assert.equal(linkState(page), "live");
  let n = 0;
  page.server.respond = (after) => {
    n += 1;
    const bad = {
      app: "sai-pixel-office",
      lines: 9,
      from: 5,
      events: [],
      server_starts: [],
    };
    if (n === 1) return bad;
    return {
      app: "sai-pixel-office",
      lines: 1,
      from: after === 1 ? 1 : 0,
      events: after === 1 ? [] : j.entries,
      server_starts: [],
    };
  };
  await page.tick(2000);
  assert.equal(linkState(page), "live", "one misfit does not change the state");
  page.server.respond = () => ({
    app: "sai-pixel-office",
    lines: 9,
    from: 5,
    events: [],
    server_starts: [],
  });
  await page.tick(2000);
  assert.equal(linkState(page), "down", "two misfits in a row");
  page.server.respond = null;
  await page.tick(2000);
  assert.equal(linkState(page), "live", "after recovery");
});

// ------------------------------------------------------------------ PN-02

const nowText = (page) => page.text("now-text");
// REQ-036: the block "Сейчас" is a list of rows, one per item in progress; the
// rows are read one by one, not from the joined text.
const nowRows = (page) =>
  page
    .el("now")
    .all((e) => e.classes.has("now-row"))
    .map((r) => r.textContent);
const nowKinds = (page) =>
  page
    .el("now")
    .all((e) => e.classes.has("now-row"))
    .map((r) => r.dataset.kind);

test("PN-02: the line 'Сейчас' - hidden before the first answer; a task with a description, without one, only the main row, several items, empty; data-busy and title; it changes after a new event; it keeps the last data when the link is lost", async () => {
  const j = journal();
  j.sessionStart("S1");
  const page = makePage({ entries: [...j.entries] });
  page.server.mode = "hang";
  await page.start();
  assert.equal(page.el("now").hidden, true);
  page.server.mode = "ok";
  await page.tick(3000);
  await page.tick(2000);
  assert.equal(page.el("now").hidden, false);
  assert.equal(nowText(page), "Сейчас: в работе ничего нет");
  assert.equal(page.el("now").dataset.busy, "false");
  // a task with a description
  j.post("S1", "tu1", "a1", {
    subagentType: "Sai Orchestrator (ORCH)",
    description: "check it",
  });
  j.subStart("S1", "a1", "Sai Orchestrator (ORCH)");
  await page.push(...j.entries.slice(-2));
  assert.deepEqual(nowRows(page), ["Оркестратор — check it"]);
  assert.equal(nowText(page), "Сейчас: Оркестратор — check it");
  assert.equal(page.el("now").dataset.busy, "true");
  assert.equal(page.el("now").title, nowText(page));
  // without a description
  j.subStart("S1", "a2", "Explore");
  await page.push(j.entries[j.entries.length - 1]);
  // REQ-036: a row per agent in the order of "Текущие", no "и ещё"
  assert.deepEqual(nowRows(page), ["Explore", "Оркестратор — check it"]);
  assert.equal(nowText(page).includes("и ещё"), false);
  assert.equal(page.el("now").title, "Сейчас: Explore\nОркестратор — check it");
  j.subStop("S1", "a2", "Explore");
  j.subStop("S1", "a1", "Sai Orchestrator (ORCH)");
  await page.push(...j.entries.slice(-2));
  assert.equal(nowText(page), "Сейчас: в работе ничего нет");
  // only the main row
  j.prompt("S1");
  await page.push(j.entries[j.entries.length - 1]);
  assert.equal(nowText(page), `Сейчас: ${MAIN_ROW}`);
  assert.deepEqual(nowKinds(page), ["main"]);
  // three items in progress: the first text and 'и ещё 2 в работе'
  j.subStart("S1", "b1", "Plan");
  j.subStart("S1", "b2", "Explore");
  await page.push(...j.entries.slice(-2));
  // three rows by rule d (new ones on top), no "и ещё"
  assert.deepEqual(nowRows(page), ["Explore", "Plan", MAIN_ROW]);
  assert.deepEqual(nowKinds(page), ["task", "task", "main"]);
  assert.equal(nowText(page).includes("и ещё"), false);
  // the link is lost: the last loaded rows and text stay
  const kept = nowText(page);
  const keptRows = nowRows(page);
  page.server.mode = "fail";
  await page.tick(2000);
  assert.equal(nowText(page), kept);
  assert.deepEqual(nowRows(page), keptRows);
  assert.equal(page.el("now").hidden, false);
});

// ------------------------------------------------------------------ PN-03

test("PN-03: the buttons - at opening 'Пауза' with aria-pressed false and 1x pressed; the pause button becomes 'Продолжить'; 4x is the only pressed speed and the sim speed is 4; the buttons do not rebuild the model or change the journal and the task panel; no links to the accounting system", async () => {
  const j = journal();
  j.sessionStart("S1");
  launch(j, "S1", "a1", "Explore");
  const page = await loaded(j.entries);
  assert.equal(page.text("pause"), PAUSE);
  assert.equal(page.el("pause").getAttribute("aria-pressed"), "false");
  const pressed = () =>
    ["speed-1", "speed-2", "speed-4"].map((id) =>
      page.el(id).getAttribute("aria-pressed"),
    );
  assert.deepEqual(pressed(), ["true", "false", "false"]);
  for (const m of [1, 2, 4])
    assert.equal(page.text(`speed-${m}`), SPEED_LABELS[m]);
  const model = page.app.getModel();
  const journalHtml = page
    .rows()
    .map((r) => r.textContent)
    .join("|");
  const tasksCount = page.items().length;
  page.el("pause").click();
  assert.equal(page.text("pause"), "Продолжить");
  assert.equal(page.el("pause").getAttribute("aria-pressed"), "true");
  assert.equal(page.app.getSim().isPaused(), true);
  page.el("speed-4").click();
  assert.deepEqual(pressed(), ["false", "false", "true"]);
  assert.equal(page.app.getSim().getSpeed(), 4);
  assert.equal(page.app.getModel(), model);
  assert.equal(
    page
      .rows()
      .map((r) => r.textContent)
      .join("|"),
    journalHtml,
  );
  assert.equal(page.items().length, tasksCount);
  const html = indexHtml();
  assert.equal(html.includes("Учётная система"), false);
  assert.equal(/<a\b/i.test(html), false);
});

// ------------------------------------------------------------------ PN-04

function allKinds() {
  const j = journal();
  j.sessionStart("S1");
  j.prompt("S1");
  launch(j, "S1", "a1", "Explore");
  j.subStop("S1", "a1", "Explore");
  j.stop("S1");
  j.subStart("S1", "ghost", "Plan");
  j.sessionEnd("S1");
  j.raw({
    ...entryOf("SubagentStart", "S1", at(j.now()), {
      agent_id: "m1",
      agent_type: "Marked",
    }),
    source: "SIMULATION",
  });
  return j;
}

test("PN-04: the filters - 'Всё' shows every row, marked ones too; 'Работа' exactly the five kinds; 'Офис' exactly the rows with a route; aria-pressed on the chosen one; at opening 'Всё'; the choice stays after a new event, a failure and recovery; an unknown filter is 'Всё'", async () => {
  const j = allKinds();
  const page = await loaded(j.entries);
  const shown = () => page.rows().map((r) => Number(r.dataset.index));
  const pressedFilter = () =>
    ["filter-all", "filter-work", "filter-office"].filter(
      (id) => page.el(id).getAttribute("aria-pressed") === "true",
    );
  assert.deepEqual(pressedFilter(), ["filter-all"]);
  for (const [name, id] of [
    ["all", "filter-all"],
    ["work", "filter-work"],
    ["office", "filter-office"],
  ]) {
    assert.equal(page.text(id), FILTER_LABELS[name]);
  }
  assert.equal(shown().length, j.entries.length);
  const all = page.app.getModel();
  const marked = page.rows().filter((r) => r.dataset.marked === "true");
  assert.equal(marked.length, 1);
  page.el("filter-work").click();
  const work = j.entries
    .map((e, i) => (CRITERION_WORK.includes(e.hook_event_name) ? i : -1))
    .filter((i) => i >= 0);
  assert.deepEqual(shown(), work);
  assert.deepEqual(pressedFilter(), ["filter-work"]);
  page.el("filter-office").click();
  const routeLines = page.app
    .getOffice()
    .routes.map((r) => r.event_index)
    .sort((a, b) => a - b);
  assert.equal(routeLines.length, 2);
  assert.deepEqual(shown(), routeLines);
  assert.equal(
    shown().includes(j.entries.length - 1),
    false,
    "the marked line has no route",
  );
  assert.deepEqual(pressedFilter(), ["filter-office"]);
  // the choice stays
  j.prompt("S1");
  await page.push(j.entries[j.entries.length - 1]);
  assert.deepEqual(pressedFilter(), ["filter-office"]);
  assert.deepEqual(
    shown(),
    routeLines,
    "the rows stay filtered after a new event",
  );
  page.server.mode = "fail";
  await page.tick(2000);
  assert.deepEqual(pressedFilter(), ["filter-office"]);
  page.server.mode = "ok";
  await page.tick(2000);
  assert.deepEqual(pressedFilter(), ["filter-office"]);
  page.app.setFilter("foreign");
  assert.deepEqual(pressedFilter(), ["filter-all"]);
  assert.ok(all.entries.length > 0);
});

// ------------------------------------------------------------------ PN-05

test("PN-05: the caption and the counter - under TZ=Asia/Almaty it starts with 'время — Asia/Almaty'; no counter before the first answer; then ' · N из M'; 250 matching rows give '200 из 250'", async (t) => {
  const out = runWithTz(
    sandbox(t),
    "Asia/Almaty",
    `import { makePage, journal } from ${JSON.stringify(HELPERS_URL)};
     const j = journal(); j.sessionStart("S1"); j.prompt("S1");
     const page = makePage({ entries: j.entries });
     page.server.mode = "hang";
     await page.start();
     const before = page.text("journal-meta");
     page.server.mode = "ok";
     await page.tick(3000);
     await page.tick(2000);
     console.log(JSON.stringify([before, page.text("journal-meta")]));`,
  );
  const [before, after] = JSON.parse(out);
  assert.ok(before.startsWith("время — Asia/Almaty"));
  assert.equal(before.includes("из"), false);
  assert.ok(after.startsWith("время — Asia/Almaty"));
  assert.ok(after.endsWith(" · 2 из 2"));
  const j = journal();
  for (let i = 0; i < 250; i++) j.prompt(`s${i % 3}`);
  const page = await loaded(j.entries);
  assert.ok(page.text("journal-meta").endsWith(" · 200 из 250"));
  const rows = page.rows();
  assert.equal(rows.length, 200);
  assert.equal(rows[0].dataset.index, "50");
  assert.equal(rows[199].dataset.index, "249");
  page.app.setFilter("office");
  assert.ok(page.text("journal-meta").endsWith(" · 0 из 0"));
});

// ------------------------------------------------------------------ PN-06

test("PN-06: a journal row - time HH:MM:SS, 8 characters of the session, who, the event, the description only of a linked launch, tone, the mark 'не подтверждена' without the source; texts from events are text", async () => {
  const j = journal();
  j.sessionStart("session-0001-long");
  j.post("session-0001-long", "tu1", "a1", {
    subagentType: "Explore",
    description: "linked task",
  });
  j.subStart("session-0001-long", "a1", "Explore");
  j.subStart("session-0001-long", "a2", undefined);
  j.subStart("session-0001-long", "a3", "Plan");
  j.raw({
    ...entryOf("Stop", "other-session-xyz", at(j.now())),
    source: "SIMULATION",
  });
  const page = await loaded(j.entries);
  const rows = page.rows();
  assert.equal(rows.length, 6);
  const cell = (row, cls) => row.byClass(cls)[0]?.textContent;
  assert.match(cell(rows[0], "time"), /:01$/);
  assert.match(cell(rows[0], "time"), /^\d\d:\d\d:\d\d$/);
  assert.equal(cell(rows[0], "session"), "session-");
  assert.equal(cell(rows[0], "who"), "Основная сессия");
  assert.equal(cell(rows[0], "event"), "Открыт разговор с Claude Code");
  assert.equal(rows[0].dataset.tone, "session");
  // REQ-045: "who" of a handoff is the one who handed over (here the main
  // session); the role is in the words
  assert.equal(cell(rows[1], "who"), "Основная сессия");
  assert.equal(cell(rows[1], "event"), "Задание передано агенту «Explore»");
  assert.equal(cell(rows[1], "row-desc"), "linked task");
  assert.equal(rows[1].dataset.tone, "handoff");
  assert.equal(
    cell(rows[2], "event"),
    "Агент «Explore» получил задание и начал работу",
  );
  assert.equal(cell(rows[2], "row-desc"), "linked task");
  assert.equal(rows[2].dataset.tone, "start");
  assert.equal(cell(rows[3], "who"), ROLE_UNKNOWN);
  assert.equal(rows[3].byClass("row-desc").length, 0);
  assert.equal(
    cell(rows[4], "row-desc"),
    undefined,
    "a description of another launch is never shown",
  );
  assert.equal(rows[4].dataset.marked, "false");
  const marked = rows[5];
  assert.equal(marked.dataset.marked, "true");
  // REQ-048, row 5: the mark without the source
  assert.equal(marked.byClass("source").length, 0);
  assert.equal(marked.textContent.includes("SIMULATION"), false);
  assert.equal(cell(marked, "mark"), "не подтверждена");
  assert.equal(cell(marked, "mark"), NOT_FROM_HOOKS);
  assert.equal(marked.dataset.tone, "end");
  const text = page.el("journal").textContent;
  assert.equal(/требован|итог/i.test(text), false);
});

// ------------------------------------------------------------------ PN-07

test("PN-07: new rows are at the bottom and the scrolling anchor - the first render and a filter change go to the bottom; a list at the bottom stays at the bottom; a list scrolled up keeps its first visible row; if it is gone, scrollTop = 0", async () => {
  const j = journal();
  for (let i = 0; i < 300; i++) j.prompt("S1");
  const page = await loaded(j.entries);
  const list = page.el("journal");
  const atBottom = () =>
    list.scrollTop === list.scrollHeight - list.clientHeight;
  assert.equal(page.rows()[0].dataset.index, "100");
  assert.equal(page.rows()[199].dataset.index, "299");
  assert.ok(atBottom(), "the first render");
  // at the bottom: stays at the bottom
  j.prompt("S1");
  await page.push(j.entries[j.entries.length - 1]);
  assert.equal(page.rows()[199].dataset.index, "300");
  assert.ok(atBottom());
  // scrolled up: the first visible row keeps its place
  list.scrollTop = 100;
  const first = () =>
    page.rows().find((r) => r.offsetTop + r.offsetHeight > list.scrollTop);
  const firstIndex = first().dataset.index;
  const offset = first().offsetTop - list.scrollTop;
  j.prompt("S1");
  await page.push(j.entries[j.entries.length - 1]);
  assert.equal(first().dataset.index, firstIndex);
  assert.equal(first().offsetTop - list.scrollTop, offset);
  // its row has been pushed out of the 200: scrollTop = 0
  list.scrollTop = 0;
  for (let i = 0; i < 3; i++) {
    j.prompt("S1");
    await page.push(j.entries[j.entries.length - 1]);
  }
  list.scrollTop = 0;
  const gone = Number(first().dataset.index);
  for (let i = 0; i < 205; i++) j.prompt("S1");
  await page.push(...j.entries.slice(-205));
  assert.ok(Number(page.rows()[0].dataset.index) > gone);
  assert.equal(list.scrollTop, 0);
  // a filter change goes to the bottom
  list.scrollTop = 10;
  page.app.setFilter("work");
  assert.ok(atBottom());
  page.app.setFilter("all");
  assert.ok(atBottom());
});

// ------------------------------------------------------------------ PN-08

test("PN-08: empty states of the journal list - before the answer nothing; a failed first load 'no-connection'; an empty journal 'empty' with the title and the hint, '0 из 0', 'в работе ничего нет'; a filter without rows 'filtered'; the filters are visible in all cases", async () => {
  const page = makePage({ entries: [] });
  page.server.mode = "hang";
  await page.start();
  assert.equal(page.rows().length, 0);
  assert.equal(page.el("journal").byClass("journal-empty").length, 0);
  await page.tick(3000);
  const note = page.el("journal").byClass("journal-empty")[0];
  assert.equal(note.dataset.reason, "no-connection");
  assert.equal(note.textContent, NO_CONNECTION);
  assert.equal(page.el("filter-all").hidden, false);
  page.server.mode = "ok";
  await page.tick(2000);
  await page.tick(2000);
  const empty = page.el("journal").byClass("journal-empty")[0];
  assert.equal(empty.dataset.reason, "empty");
  assert.equal(
    empty.byClass("empty-title")[0].textContent,
    "Событий от Claude Code пока нет",
  );
  assert.equal(empty.byClass("empty-hint")[0].textContent, EMPTY_HINT);
  assert.ok(page.text("journal-meta").endsWith(" · 0 из 0"));
  assert.equal(nowOf(page), "Сейчас: в работе ничего нет");
  assert.equal(page.el("filter-office").hidden, false);
  const j = journal();
  j.sessionStart("S1");
  const filled = await loaded(j.entries);
  filled.app.setFilter("office");
  const none = filled.el("journal").byClass("journal-empty")[0];
  assert.equal(none.dataset.reason, "filtered");
  // REQ-046 (design D10): one text for every empty choice and a button that
  // takes all filters away
  assert.equal(
    none.byClass("empty-title")[0].textContent,
    "Под выбранные фильтры не подходит ни одно событие",
  );
  assert.equal(none.textContent.includes(NO_DATA), false);
  const reset = none.all((e) => e.tagName === "BUTTON");
  assert.equal(reset.length, 1);
  assert.equal(reset[0].textContent, "Сбросить фильтры");
  assert.equal(filled.el("filter-work").hidden, false);
  reset[0].click();
  await settle();
  assert.equal(filled.el("filter-all").getAttribute("aria-pressed"), "true");
  assert.equal(
    filled.el("filter-office").getAttribute("aria-pressed"),
    "false",
  );
  assert.equal(filled.rows().length, 1);
});

function nowOf(page) {
  return page.text("now-text");
}

// ------------------------------------------------------------------ PN-09

test("PN-09: the task panel - 'Текущие' hold what is in progress, 'История' the rest, new ones on top; item parts and colours; the main row; time lines; empty sections; no requirement numbers; items move between sections after an event", async () => {
  const j = journal();
  j.sessionStart("A");
  j.sessionStart("B");
  launch(j, "A", "a1", "Sai Orchestrator (ORCH)", { description: "first" });
  j.subStop("A", "a1", "Sai Orchestrator (ORCH)");
  launch(j, "A", "a2", "Explore");
  j.prompt("A");
  launch(j, "B", "b1", "Plan");
  j.sessionEnd("B");
  const page = await loaded(j.entries);
  const before = await loaded(j.entries.slice(0, 4));
  const running = before.items().find((i) => i.dataset.key === "a1");
  assert.equal(running.dataset.state, "in_progress");
  assert.equal(running.byClass("item-role")[0].textContent, "Оркестратор");
  const children = page.el("tasks").children;
  const sectionOf = (item) => {
    let section = null;
    for (const c of children) {
      if (c.classes.has("section-title")) section = c.dataset.section;
      if (c === item) return section;
    }
    return null;
  };
  const items = page.items();
  const bySection = (name) => items.filter((i) => sectionOf(i) === name);
  const current = bySection("current");
  const history = bySection("history");
  assert.deepEqual(
    current.map((i) => i.dataset.key),
    [
      "main:" +
        j.entries.findIndex((e) => e.hook_event_name === "UserPromptSubmit"),
      "a2",
    ],
  );
  assert.deepEqual(
    history.map((i) => i.dataset.key),
    ["b1", "a1"],
  );
  const orch = history[1];
  // REQ-036: the name of the role in plain words, the same text in the
  // "История" (here) and in "Текущие" before the SubagentStop (below)
  assert.equal(orch.byClass("item-role")[0].textContent, "Оркестратор");
  // REQ-048: no code of the role on view; it is in the title of the name
  assert.equal(orch.byClass("item-full").length, 0);
  assert.equal(
    orch.byClass("item-role")[0].getAttribute("title"),
    "код роли: Sai Orchestrator (ORCH)",
  );
  assert.equal(orch.byClass("item-desc")[0].textContent, "first");
  assert.equal(
    orch.byClass("item-state")[0].textContent,
    STATE_LABELS.completed,
  );
  // REQ-042 criterion 5: the word is the one of the criterion, not "завершена"
  assert.equal(
    orch.byClass("item-state")[0].textContent,
    "закончила работу, итог не записан",
  );
  assert.equal(orch.byClass("item-role")[0].dataset.color, "1");
  assert.equal(orch.byClass("ended").length, 1);
  assert.equal(history[0].byClass("item-desc").length, 0);
  assert.equal(
    history[0].byClass("item-state")[0].textContent,
    STATE_LABELS.unrecorded,
  );
  const row = current[0];
  assert.equal(row.byClass("item-role")[0].textContent, MAIN_ROW);
  assert.equal(row.byClass("item-role")[0].dataset.color, "0");
  assert.equal(row.byClass("item-full").length, 0);
  assert.equal(current[1].byClass("last-event").length, 1);
  assert.equal(page.el("tasks").textContent.includes("REQ-"), false);
  // an event moves an item between sections
  j.subStop("A", "a2", "Explore");
  await page.push(j.entries[j.entries.length - 1]);
  const moved = page.items().find((i) => i.dataset.key === "a2");
  const sectionNow = (item) => {
    let section = null;
    for (const c of page.el("tasks").children) {
      if (c.classes.has("section-title")) section = c.dataset.section;
      if (c === item) return section;
    }
    return null;
  };
  assert.equal(sectionNow(moved), "history");
  assert.equal(moved.dataset.state, "completed");
  // empty sections
  const e = await loaded([entryOf("SessionStart", "S", at(1))]);
  const empties = e
    .el("tasks")
    .byClass("section-empty")
    .map((p) => p.textContent);
  assert.deepEqual(empties.slice(0, 2), [NOW_EMPTY, NO_DATA]);
});

// ------------------------------------------------------------------ PN-10

const cardsOf = (page) => page.el("tasks").byClass("session-card");
// REQ-042 criterion 3: a card has the word, the 8 characters, the first and
// the last event and the age; no bar and no counters.
const cardOf = (card) => ({
  id: card.byClass("session-id")[0].textContent,
  running: card.dataset.running,
  word: card.dataset.word,
  badge: card.byClass("session-badge")[0]?.textContent ?? null,
  first: card.byClass("first-event")[0]?.textContent ?? null,
  last: card.byClass("last-event")[0]?.textContent ?? null,
  age: card.byClass("age")[0]?.textContent ?? null,
});

test("PN-10: session cards - one per running session above 'Текущие', new ones on top, 8 characters, the word, the first and the last event and the age; no bar and no 'задач n/m · ролей k'; a resumed task and two tasks of one role make no counters; a finished session's card sits in 'История' above its topmost shown item without '• Идёт'; the times change after an event", async () => {
  const j = journal();
  j.sessionStart("aaaaaaaa-1");
  j.sessionStart("bbbbbbbb-2");
  launch(j, "aaaaaaaa-1", "t1", "Explore");
  launch(j, "aaaaaaaa-1", "t2", "Explore");
  launch(j, "aaaaaaaa-1", "t3", "Plan");
  j.subStop("aaaaaaaa-1", "t1", "Explore");
  // a task resumed in another session belongs to it
  j.subStart("bbbbbbbb-2", "t3", "Plan");
  j.subStop("bbbbbbbb-2", "t3", "Plan");
  launch(j, "cccccccc-3", "t4", "Explore");
  j.sessionEnd("cccccccc-3");
  const page = await loaded(j.entries);
  const eventsOf = (sid) =>
    j.entries.filter((e) => e.session_id === sid).map((e) => e.time);
  const cards = cardsOf(page).map(cardOf);
  const running = cards.filter((c) => c.running === "true");
  assert.deepEqual(
    running.map((c) => c.id),
    ["bbbbbbbb", "aaaaaaaa"],
    "new ones on top",
  );
  for (const c of running) {
    assert.equal(c.word, "running");
    assert.equal(c.badge, "• Идёт");
    const times = eventsOf(`${c.id}-${c.id === "aaaaaaaa" ? 1 : 2}`);
    assert.equal(c.first, fmtTime(times[0]));
    assert.equal(c.last, fmtTime(times[times.length - 1]));
    assert.match(c.age, /назад$/);
  }
  // no bar and no counters anywhere in the panel
  for (const card of cardsOf(page)) {
    assert.equal(card.all((e) => e.tagName === "PROGRESS").length, 0);
    assert.equal(card.byClass("session-progress").length, 0);
    assert.equal(card.byClass("session-stats").length, 0);
    assert.doesNotMatch(card.textContent, /задач|ролей|\d+\/\d+/);
  }
  // the finished session's card is in the history, above its topmost item, no badge
  const children = page.el("tasks").children;
  const finished = cardsOf(page).find((c) => c.dataset.running === "false");
  assert.ok(finished !== undefined);
  assert.equal(finished.byClass("session-badge").length, 0);
  assert.equal(finished.dataset.word, undefined, "SessionEnd: no word");
  assert.equal(finished.dataset.session, "cccccccc");
  assert.equal(cardOf(finished).first, fmtTime(eventsOf("cccccccc-3")[0]));
  // a running session has no second card in the history
  const notRunning = cardsOf(page)
    .filter((c) => c.dataset.running === "false")
    .map((c) => c.dataset.session);
  assert.deepEqual(notRunning, ["cccccccc"]);
  const at_ = children.indexOf(finished);
  assert.equal(children[at_ + 1].dataset.key, "t4");
  const historyAt = children.findIndex((c) => c.dataset?.section === "history");
  assert.ok(at_ > historyAt);
  for (const c of cardsOf(page).filter((x) => x.dataset.running === "true")) {
    assert.ok(
      children.indexOf(c) <
        children.findIndex((x) => x.dataset?.section === "current"),
    );
    assert.equal(c.byClass("session-badge").length, 1);
  }
  // after an event the last time and the age change
  const before = cardOf(
    cardsOf(page).find((c) => c.dataset.session === "aaaaaaaa"),
  );
  j.time(j.now() + 300); // five minutes later: the shown time has minutes
  j.subStop("aaaaaaaa-1", "t2", "Explore");
  await page.push(j.entries[j.entries.length - 1]);
  const after = cardOf(
    cardsOf(page).find((c) => c.dataset.session === "aaaaaaaa"),
  );
  assert.equal(after.first, before.first);
  assert.equal(after.last, fmtTime(j.entries[j.entries.length - 1].time));
  assert.notEqual(after.last, before.last);
  // after a server start the session has no word: it is not running, its card
  // moves to the history (it has tasks) and says nothing about "• Идёт"
  const u = journal();
  u.sessionStart("uuuuuuuu-1");
  launch(u, "uuuuuuuu-1", "u1", "Explore");
  u.subStop("uuuuuuuu-1", "u1", "Explore");
  launch(u, "uuuuuuuu-1", "u2", "Plan");
  const unrec = await loaded(u.entries, [
    { time: at(99), journal_lines: u.entries.length },
  ]);
  const uc = cardsOf(unrec);
  assert.equal(uc.length, 1);
  assert.equal(uc[0].dataset.running, "false");
  assert.equal(uc[0].dataset.word, undefined);
  assert.equal(uc[0].byClass("session-badge").length, 0);
  // a session without tasks still has a card while it runs
  const empty = await loaded([entryOf("SessionStart", "sess-empty-1", at(1))]);
  assert.equal(cardOf(cardsOf(empty)[0]).word, "running");
  assert.equal(cardOf(cardsOf(empty)[0]).first, fmtTime(at(1)));
});

// ------------------------------------------------------------------ PN-11

test("PN-11: the limit of cards - 400 finished sessions with one task: 300 items in 'История', exactly as many session cards as sessions among the shown items, none for a session without a shown item, 'показано 300 из 400'; the cases of the criterion: 301 tasks of one session, a resumed task A -> B", async () => {
  const j = journal();
  for (let i = 0; i < 400; i++) {
    const s = `${String(i).padStart(4, "0")}-session`;
    launch(j, s, `t${i}`, "Explore");
    j.subStop(s, `t${i}`, "Explore");
    j.sessionEnd(s);
  }
  const page = await loaded(j.entries);
  assert.equal(page.items().length, 300);
  const cards = cardsOf(page);
  assert.equal(cards.length, 300);
  const sessionsOfItems = new Set(
    page.items().map((i) => i.byClass("session")[0].textContent),
  );
  assert.equal(sessionsOfItems.size, 300);
  for (const c of cards) {
    assert.ok(sessionsOfItems.has(c.byClass("session-id")[0].textContent));
    assert.ok(c.byClass("first-event")[0].textContent !== "");
    assert.ok(c.byClass("last-event")[0].textContent !== "");
  }
  assert.equal(
    page.el("tasks").byClass("tasks-note")[0].textContent,
    "показано 300 из 400",
  );
  // 400 sessions with one task each are 400 tasks: the first shown are the newest
  assert.equal(page.items()[0].dataset.key, "t399");
  // 301 tasks of one finished session: 300 items, one card with its times
  const k = journal();
  for (let i = 0; i < 301; i++) {
    launch(k, "big-session", `x${i}`, "Explore");
    k.subStop("big-session", `x${i}`, "Explore");
  }
  k.sessionEnd("big-session");
  const big = await loaded(k.entries);
  assert.equal(big.items().length, 300);
  assert.equal(cardsOf(big).length, 1);
  const card = cardOf(cardsOf(big)[0]);
  assert.equal(card.id, "big-sess");
  assert.equal(card.first, fmtTime(k.entries[0].time));
  assert.equal(card.last, fmtTime(k.entries[k.entries.length - 1].time));
  assert.equal(
    big.el("tasks").byClass("tasks-note")[0].textContent,
    "показано 300 из 301",
  );
  // a resumed task: start X in A, start X in B, end X in B
  const r = journal();
  r.sessionStart("A-session-1");
  r.sessionStart("B-session-2");
  r.subStart("A-session-1", "X", "Explore");
  r.subStart("B-session-2", "X", "Explore");
  r.subStop("B-session-2", "X", "Explore");
  const m = buildModel(r.entries, [], NOW);
  const cardsR = cardsOf(await loaded(r.entries)).map(cardOf);
  assert.deepEqual(cardsR.map((c) => c.id).sort(), ["A-sessio", "B-sessio"]);
  assert.equal(m.tasks.length, 1);
  assert.equal(m.tasks[0].session_id, "B-session-2");
});

// ------------------------------------------------------------------ PN-12

test("PN-12: before the first load and after a failed one - the task body is empty, 'Сейчас' is hidden, the legend is empty, the office is the fixed layer with an empty zone of desks (35 x 22) and no characters", async () => {
  for (const mode of ["hang", "fail"]) {
    const page = makePage({ entries: [] });
    page.server.mode = mode;
    await page.start();
    if (mode === "hang") await page.tick(3000);
    assert.equal(page.el("tasks").children.length, 0, mode);
    assert.equal(page.el("now").hidden, true);
    assert.equal(page.legend().length, 0);
    assert.deepEqual(page.app.getOffice().layout, buildLayout(0));
    assert.deepEqual(
      [page.app.getOffice().layout.width, page.app.getOffice().layout.height],
      [35, 22],
    );
    assert.equal(page.app.getOffice().characters.length, 0);
    assert.equal(page.el("tasks").byClass("section-title").length, 0);
  }
});

// ------------------------------------------------------------------ PN-13

test("PN-13: 'Запуски сервера' - every start record, also stale ones, newest first, in fmtDateTime; 'Нет данных' without records; no separate panel, no 'Офис' title above the canvas, no zone in the header", async () => {
  const j = journal();
  j.sessionStart("S1");
  const starts = [
    { time: at(-100), journal_lines: 0 },
    { time: at(5), journal_lines: 1 },
    { time: at(50), journal_lines: 99 },
  ];
  const page = await loaded(j.entries, starts);
  const list = page.el("tasks").byClass("starts")[0];
  assert.deepEqual(
    list.children.map((li) => li.textContent),
    [...starts].reverse().map((s) => fmtDateTime(s.time)),
  );
  const none = await loaded(j.entries, []);
  const lastEmpty = none.el("tasks").byClass("section-empty").pop();
  assert.equal(lastEmpty.textContent, NO_DATA);
  const doc = new FakeDocument(indexHtml());
  assert.equal(
    doc.root
      .all((e) => e.tagName === "H2")
      .map((h) => h.textContent)
      .includes("Офис"),
    false,
  );
  assert.equal(doc.getElementById("link").textContent.includes("Asia"), false);
  assert.equal(doc.root.all((e) => e.classes.has("panel-starts")).length, 0);
});

// ------------------------------------------------------------------ PN-14

test("PN-14: one stream - after one event every view (Сейчас, journal and counter, tasks and summaries, legend, board, bubbles, card) is rebuilt from the same entries array and agrees with the others", async () => {
  const j = journal();
  j.sessionStart("S1");
  j.prompt("S1");
  launch(j, "S1", "a1", "Explore");
  const page = await loaded(j.entries, [], { now: T0 + 5000 });
  const ref = page.app.getModel().entries;
  page.legend()[1].click();
  j.stop("S1");
  launch(j, "S1", "a2", "Plan");
  page.clock.set(page.clock.now());
  await page.push(...j.entries.slice(-3));
  assert.equal(page.app.getModel().entries, ref, "the same array");
  assert.equal(ref.length, j.entries.length);
  assert.equal(page.rows().length, j.entries.length);
  assert.ok(
    page
      .text("journal-meta")
      .endsWith(` · ${j.entries.length} из ${j.entries.length}`),
  );
  const plan = page.legend().find((b) => b.dataset.key === "role:Plan");
  assert.equal(plan.dataset.state, "working");
  assert.ok(
    page
      .items()
      .some((i) => i.dataset.key === "a2" && i.dataset.state === "in_progress"),
  );
  assert.ok(
    page.text("now-text").includes("Plan") ||
      page.text("now-text").includes("Explore"),
  );
  const column = page.app
    .getOffice()
    .board.columns.find((c) => c.key === "role:Plan");
  assert.equal(column.counts.in_progress, 1);
  page.ctx.clear();
  page.frames.step();
  assert.ok(
    page.ctx
      .lastFrame()
      .some(
        (c) => c.op === "fillText" && c.args[0] === "Plan" && c.args[3] === 52,
      ),
    "on the board",
  );
  assert.equal(page.el("card-overlay").hidden, false);
  // REQ-044: the card of an instance names the workplace of its role, no
  // "в работе: N"
  const workplace = () =>
    page
      .el("card")
      .find((e) => e.dataset.row === "workplace")
      .byClass("state-value")[0].textContent;
  assert.equal(workplace(), "работает — у этой роли задач «в работе»: 1");
  assert.equal(page.el("card").byClass("card-working").length, 0);
  // REQ-042: the explanation of what the journal does not confirm is rebuilt
  // in the same build, from the same model, by a tick of the clock alone
  page.clock.set(page.clock.now() + STALE_AFTER_MS + 60_000);
  page.clock.fire();
  await settle();
  const model = page.app.getModel();
  assert.equal(model.entries, ref, "still the same array");
  const unconfirmed = model.list.filter((i) => i.state === "stale");
  assert.ok(unconfirmed.length >= 2);
  assert.equal(model.unconfirmed.count, unconfirmed.length);
  assert.equal(
    page.text("now-text"),
    `Сейчас: в работе ничего нет · без свежих данных: ${unconfirmed.length}`,
  );
  const note = page.el("tasks").byClass("unconfirmed-note");
  assert.equal(note.length, 1);
  assert.equal(
    page.el("now").title,
    note[0].textContent,
    "one text, two places",
  );
  assert.equal(
    page.legend().find((b) => b.dataset.key === "role:Plan").dataset.state,
    "idle",
  );
  assert.equal(page.app.getOffice().board.columns.length, 0);
  assert.equal(
    workplace(),
    "свободен — по журналу у этой роли нет задачи «в работе»; это вывод по событиям, а не событие",
  );
  assert.equal(page.el("card").byClass("card-working").length, 0);
  const cardStale = page
    .el("card")
    .all((e) => e.dataset.list === "unconfirmed")[0];
  assert.ok(cardStale.byClass("item").length >= 1);
});

// ------------------------------------------------------------------ PN-15

test("PN-15: safe output - an <img onerror> as description, agent_type and session_id gives no IMG in 'Сейчас', the journal, the panel, the summaries, the legend or the card; the text is textContent; the title is text", async () => {
  const j = journal();
  j.sessionStart(IMG);
  j.prompt(IMG);
  j.post(IMG, "tu", "a1", { subagentType: IMG, description: IMG });
  j.subStart(IMG, "a1", IMG);
  const page = await loaded(j.entries);
  page.legend()[1].click();
  assert.equal(page.created("img").length, 0);
  assert.equal(page.doc.htmlWrites, 0);
  assert.equal(page.el("now").title.includes("<img"), true);
  assert.ok(page.el("now-text").textContent.includes(IMG.slice(0, 15)));
  assert.ok(withText(page.el("journal"), IMG).length >= 1);
  assert.ok(withText(page.el("tasks"), IMG).length >= 1);
  assert.ok(withText(page.el("legend"), IMG).length >= 1);
  assert.ok(withText(page.el("card"), IMG).length >= 1);
  const short = Array.from(IMG).slice(0, 8).join("");
  assert.ok(page.el("tasks").byClass("session-id")[0].textContent === short);
});

// ------------------------------------------------------------------ PN-16

test("PN-16: network - over a whole session (start, polls, failure, recovery, all filters, pause and speeds, a click on a character and the legend, closing the card) every fetch is {method: 'GET'} to /api/events?after=", async () => {
  const j = journal();
  j.sessionStart("S1");
  launch(j, "S1", "a1", "Explore");
  const page = await loaded(j.entries);
  page.server.mode = "fail";
  await page.tick(2000);
  page.server.mode = "ok";
  await page.tick(2000);
  for (const f of ["filter-work", "filter-office", "filter-all"])
    page.el(f).click();
  page.el("pause").click();
  for (const s of ["speed-2", "speed-4", "speed-1"]) page.el(s).click();
  page.legend()[1].click();
  page.el("card").byClass("card-close")[0].click();
  page.canvas.rect = { left: 0, top: 0, width: 960, height: 600 };
  page.canvas.click({ clientX: 300, clientY: 300 });
  page.frames.run(5);
  assert.ok(page.server.calls.length >= 3);
  for (const c of page.server.calls) {
    assert.deepEqual(Object.keys(c.init).sort(), ["method", "signal"]);
    assert.equal(c.init.method, "GET");
    assert.ok(c.url.startsWith("/api/events?after="), c.url);
  }
});

// ------------------------------------------------------------------ PN-17

test("PN-17: markup and captions - every identifier of the frame table of 4.7 is in index.html with the named element and class; the constant captions equal texts.js before and after start(); no style attributes and no access to style or cssText", async () => {
  const doc = new FakeDocument(indexHtml());
  const table = [
    ["link", "DIV", "link"],
    ["link-status", "SPAN", "link-status"],
    ["source-badge", "SPAN", "link-source"],
    ["now", "DIV", "now"],
    ["now-text", "SPAN", "now-text"],
    ["pause", "BUTTON", "ctl"],
    ["speed-1", "BUTTON", "ctl"],
    ["speed-2", "BUTTON", "ctl"],
    ["speed-4", "BUTTON", "ctl"],
    ["office-panel", "SECTION", "panel-office"],
    ["office-inner", "DIV", "office-inner"],
    ["office-scroll", "DIV", "office-scroll"],
    ["office", "CANVAS", null],
    ["office-note", "P", "office-note"],
    ["legend", "UL", "legend"],
    ["journal-title", "H2", null],
    ["filter-all", "BUTTON", "filter"],
    ["filter-work", "BUTTON", "filter"],
    ["filter-office", "BUTTON", "filter"],
    ["journal-meta", "P", "journal-meta"],
    ["journal", "UL", "journal"],
    ["tasks-title", "H2", null],
    ["tasks", "DIV", "tasks"],
    ["card-overlay", "DIV", "overlay"],
    ["card", "DIV", "card"],
  ];
  for (const [id, tag, cls] of table) {
    const el = doc.getElementById(id);
    assert.ok(el, id);
    assert.equal(el.tagName, tag, id);
    if (cls !== null) assert.ok(el.classes.has(cls), `${id}.${cls}`);
  }
  assert.ok(doc.getElementById("journal").getAttribute("tabindex") === "0");
  const scroll = doc.getElementById("office-scroll");
  assert.equal(scroll.getAttribute("tabindex"), "0");
  assert.equal(scroll.getAttribute("aria-label"), OFFICE_SCROLL_LABEL);
  assert.equal(doc.getElementById("card").getAttribute("role"), "dialog");
  const constants = () => ({
    title: doc.root.find((e) => e.classes.has("top-title")).textContent,
    journal: doc.getElementById("journal-title").textContent,
    tasks: doc.getElementById("tasks-title").textContent,
    pause: doc.getElementById("pause").textContent,
    speeds: [1, 2, 4].map((m) => doc.getElementById(`speed-${m}`).textContent),
    filters: ["all", "work", "office"].map(
      (f) => doc.getElementById(`filter-${f}`).textContent,
    ),
    badge: doc.getElementById("source-badge").textContent,
    noscript: doc.root.find((e) => e.classes.has("noscript")).textContent,
  });
  const expected = {
    title: "Pixel Office",
    journal: JOURNAL_TITLE,
    tasks: TASKS_TITLE,
    pause: PAUSE,
    speeds: [SPEED_LABELS[1], SPEED_LABELS[2], SPEED_LABELS[4]],
    filters: [FILTER_LABELS.all, FILTER_LABELS.work, FILTER_LABELS.office],
    badge: HEADER_BADGE,
    noscript: NOSCRIPT,
  };
  assert.deepEqual(constants(), expected);
  const page = await loaded([entryOf("SessionStart", "S1", at(1))]);
  page.legend()[0].click();
  page.el("pause").click();
  page.el("pause").click();
  assert.equal(page.text("source-badge"), HEADER_BADGE);
  assert.equal(
    page.el("office-scroll").getAttribute("aria-label"),
    OFFICE_SCROLL_LABEL,
  );
  assert.equal(page.text("journal-title"), JOURNAL_TITLE);
  assert.equal(page.text("tasks-title"), TASKS_TITLE);
  assert.equal(page.text("pause"), PAUSE);
  assert.deepEqual(
    ["speed-1", "speed-2", "speed-4"].map((id) => page.text(id)),
    expected.speeds,
  );
  assert.deepEqual(
    ["filter-all", "filter-work", "filter-office"].map((id) => page.text(id)),
    expected.filters,
  );
  assert.equal(page.doc.root.all((e) => e.hasAttribute("style")).length, 0);
  assert.equal(doc.root.all((e) => e.hasAttribute("style")).length, 0);
  assert.equal(page.doc.styleTouches, 0);
  assert.equal(page.doc.htmlWrites, 0);
});

// ------------------------------------------------------------------ PN-18

test("PN-18: the legend and the card - a legend button opens the same card as a click on the character; focus goes to the close button; Escape, a click on the overlay outside the card and the cross close it; focus returns to the legend button; the choice stays; a character that disappears closes the card and drops the choice", async () => {
  const j = journal();
  j.sessionStart("S1");
  launch(j, "S1", "a1", "Explore");
  const page = await loaded(j.entries);
  const button = () =>
    page.legend().find((b) => b.dataset.key === "role:Explore");
  button().click();
  assert.equal(page.el("card-overlay").hidden, false);
  assert.ok(
    page.doc.focused === page.el("card").byClass("card-close")[0],
    "focus is not on the expected element",
  );
  const title = page.el("card").byClass("card-title")[0].textContent;
  assert.equal(title, "Explore");
  // Escape
  page.doc.fire("keydown", { key: "Escape" });
  assert.equal(page.el("card-overlay").hidden, true);
  assert.ok(
    page.doc.focused === button(),
    "focus is not on the expected element",
  );
  assert.equal(
    button().getAttribute("aria-pressed"),
    "true",
    "the choice stays",
  );
  // the overlay outside the card
  button().click();
  page.el("card-overlay").click({ target: page.el("card-overlay") });
  assert.equal(page.el("card-overlay").hidden, true);
  // a click inside the card does not close it
  button().click();
  page.el("card-overlay").fire("click", { target: page.el("card") });
  assert.equal(page.el("card-overlay").hidden, false);
  // the cross
  page.el("card").byClass("card-close")[0].click();
  assert.equal(page.el("card-overlay").hidden, true);
  assert.ok(
    page.doc.focused === button(),
    "focus is not on the expected element",
  );
  // the same card from the canvas
  const office = page.app.getOffice();
  const seat = office.layout.desks[1].seat;
  // the canvas is shown at 24 px per cell: a click is in logical px
  page.canvas.rect = {
    left: 0,
    top: 0,
    width: office.layout.width * 24,
    height: office.layout.height * 24,
  };
  page.canvas.click({
    clientX: seat[0] * 24 + 12 - office.layout.min_x * 24,
    clientY: seat[1] * 24 + 12,
  });
  assert.equal(page.el("card-overlay").hidden, false);
  assert.equal(page.el("card").byClass("card-title")[0].textContent, title);
  // the character disappears (its line loses trust): the card closes, the choice is dropped
  page.server.respond = () => ({
    app: "sai-pixel-office",
    lines: j.entries.length,
    from: 0,
    events: j.entries.map((e) =>
      e.agent_id === "a1" ? { ...e, source: "SIMULATION" } : e,
    ),
    server_starts: [],
  });
  await page.tick(2000);
  assert.equal(
    page.app.getOffice().characters.some((c) => c.key === "role:Explore"),
    false,
  );
  assert.equal(page.el("card-overlay").hidden, true);
  assert.equal(
    page.legend().every((b) => b.getAttribute("aria-pressed") === "false"),
    true,
  );
});

// ------------------------------------------------ REQ-008 part (b): PN-19..22

// Two requests of one session, a service message between them and a row of
// the old format (no prompt_kind) of another session that has no window.
function twoRequests() {
  const j = journal();
  j.sessionStart("S1");
  const o1 = j.ownerPrompt("S1", "первый запрос");
  launch(j, "S1", "a1", "Explore", { description: "работа А" });
  j.subStop("S1", "a1", "Explore");
  j.stop("S1");
  const svc = j.servicePrompt("S1");
  const o2 = j.ownerPrompt("S1", "второй запрос");
  launch(j, "S1", "a2", "Plan", { description: "работа Б" });
  const old = j.prompt("S9");
  return { j, o1, o2, svc, old };
}

const INTERACTIVE = ["BUTTON", "A", "INPUT", "SELECT", "TEXTAREA"];
const interactive = (root) =>
  root.all(
    (e) =>
      INTERACTIVE.includes(e.tagName) ||
      e.attrs.has("tabindex") ||
      e.attrs.has("role"),
  );
const itemOf = (page, key) =>
  page.items().find((i) => i.dataset.key === key) ?? null;
const buttonOf = (page, key) => itemOf(page, key)?.byClass("history-open")[0];

test("PN-19: opening - from the button of a row of the journal (the row itself opens its details) and from the button of a card of a task or of the main session, not from the card itself or from the card of an agent; a service message only says so; a row without a window is as it was; the order of the sections", async () => {
  const fx = twoRequests();
  const page = await loaded(fx.j.entries);
  const h = buildHistory(page.app.getModel());
  const k1 = `req:${fx.o1}`;
  const k2 = `req:${fx.o2}`;
  assert.deepEqual([...h.byKey.keys()], [k1, k2]);

  // rows of the journal (REQ-045, design 5.1): every row is a button that
  // opens its details; a request of the owner with a window has a second,
  // separate button that opens the window
  assert.deepEqual(
    historyRows(page).map((r) => r.dataset.request),
    [k1, k2],
  );
  for (const row of historyRows(page)) {
    assert.equal(row.hasAttribute("tabindex"), false);
    const controls = interactive(row);
    assert.equal(controls.length, 2, "exactly two controls in the row");
    assert.equal(controls[0].tagName, "BUTTON");
    assert.ok(controls[0].classes.has("row-toggle"));
    assert.equal(controls[1].tagName, "BUTTON");
    assert.ok(controls[1].classes.has("history-open"));
    assert.equal(controls[1].dataset.request, row.dataset.request);
    assert.equal(controls[1].textContent, TX.HISTORY_OPEN);
  }
  const svcRow = page
    .rows()
    .find((r) => r.textContent.includes(TX.HISTORY_SERVICE));
  assert.ok(svcRow !== undefined, "the service message is signed");
  assert.equal(svcRow.classes.has("opens-history"), false);
  assert.equal(svcRow.hasAttribute("tabindex"), false);
  assert.equal(svcRow.hasAttribute("data-request"), false);
  // REQ-048, row 16: no second caption; the words of case 4 hold it once
  assert.equal(svcRow.byClass("history-service").length, 0);
  assert.equal(svcRow.textContent.split(TX.HISTORY_SERVICE).length - 1, 1);
  const plain = page
    .rows()
    .filter((r) => !r.classes.has("opens-history") && r !== svcRow);
  for (const row of [...plain, svcRow]) {
    assert.equal(row.hasAttribute("tabindex"), false);
    assert.equal(row.byClass("row-toggle").length, 1);
    assert.equal(interactive(row).length, 1, "only the toggle");
    assert.equal(row.byClass("history-open").length, 0);
  }
  for (const row of plain) {
    assert.equal(row.byClass("history-service").length, 0);
  }
  // a press on the toggle of any row opens its details, never the window
  const dom = historyDom(page);
  const toggleOf = (row) => row.byClass("row-toggle")[0];
  toggleOf(svcRow).click();
  for (const row of plain)
    toggleOf(
      page.rows().find((r) => r.dataset.index === row.dataset.index),
    ).click();
  for (const key of [k1, k2]) toggleOf(historyRowOf(page, key)).click();
  assert.equal(dom.isOpen(), false);
  assert.equal(page.el("journal").byClass("event-details").length, 1);
  // the button of the first request opens the first window, the second the second
  historyRowOf(page, k1).byClass("history-open")[0].click();
  assert.equal(dom.isOpen(), true);
  assert.equal(dom.title().textContent, "первый запрос");
  // the order of the sections, top to bottom
  assert.equal(dom.body.children[0].textContent, TX.HISTORY_BADGE);
  assert.deepEqual(
    dom.body.children.slice(3).map((k) => k.dataset.section),
    ["request", "understood", "work", "timeline"],
  );
  dom.close.click();
  historyRowOf(page, k2).byClass("history-open")[0].click();
  assert.equal(dom.title().textContent, "второй запрос");
  dom.close.click();
  assert.equal(dom.isOpen(), false);

  // cards of the panel: a button with the key of the request, last in the card
  const expected = new Map([
    ["a1", k1],
    ["a2", k2],
    [`main:${fx.o1}`, k1],
    [`main:${fx.svc}`, k1],
    [`main:${fx.o2}`, k2],
  ]);
  const items = page.items();
  assert.ok(items.length >= 6);
  for (const item of items) {
    const key = item.dataset.key;
    const buttons = item.byClass("history-open");
    assert.equal(item.tagName, "DIV");
    assert.equal(
      item.hasAttribute("tabindex"),
      false,
      `${key}: no focus on the card`,
    );
    assert.equal(item.hasAttribute("role"), false, `${key}: no role`);
    assert.equal(item.listeners.size, 0, `${key}: no handlers on the card`);
    // REQ-047: every item has the button "агент" to its card
    const agentButtons = item.byClass("item-agent");
    assert.equal(agentButtons.length, 1, `${key}: the button "агент"`);
    assert.equal(agentButtons[0].tagName, "BUTTON");
    assert.equal(agentButtons[0].textContent, "агент");
    if (!expected.has(key)) {
      assert.equal(buttons.length, 0, `${key}: no window, no button`);
      assert.equal(interactive(item).length, 1, `${key}: only "агент"`);
      continue;
    }
    assert.equal(buttons.length, 1, key);
    const b = buttons[0];
    assert.ok(
      item.children[item.children.length - 1] === b,
      "the button is last",
    );
    assert.equal(b.tagName, "BUTTON");
    assert.equal(b.getAttribute("type"), "button");
    assert.equal(b.textContent, TX.HISTORY_OPEN);
    assert.equal(b.dataset.request, expected.get(key));
    assert.equal(
      interactive(item).length,
      2,
      "the button of the window and the button of the agent",
    );
  }
  assert.equal(
    items.filter((i) => expected.has(i.dataset.key)).length,
    expected.size,
  );
  // a click on the card (and on its parts) but the button opens nothing
  for (const item of items) {
    item.click();
    for (const part of item.children) {
      if (part.tagName !== "BUTTON") part.click();
    }
  }
  assert.equal(dom.isOpen(), false);
  // the button of the task opens the window of its own request
  buttonOf(page, "a1").click();
  assert.equal(dom.isOpen(), true);
  assert.equal(dom.title().textContent, "первый запрос");
  dom.close.click();
  buttonOf(page, `main:${fx.o2}`).click();
  assert.equal(dom.title().textContent, "второй запрос");
  dom.close.click();

  // the card of an agent (finished and in progress) has no button and opens no window
  for (const role of ["role:Explore", "role:Plan"]) {
    const legend = page.legend().find((b) => b.dataset.key === role);
    legend.click();
    assert.equal(page.el("card-overlay").hidden, false);
    const card = page.el("card");
    assert.ok(card.byClass("item").length > 0, `${role}: the card has items`);
    assert.equal(card.byClass("history-open").length, 0);
    assert.equal(card.all((e) => e.hasAttribute("data-request")).length, 0);
    for (const el of card.all((e) => e.tagName !== "BUTTON")) el.click();
    assert.equal(dom.isOpen(), false);
    page.el("card").byClass("card-close")[0].click();
    assert.equal(page.el("card-overlay").hidden, true);
  }
});

// A hostile text of the owner, of a record, of a role and of a description.
const HOSTILE_TEXT = [
  "<script>window.__x=1</script>",
  "<img src=x onerror=window.__x=2>",
  "&lt;b&gt;",
  "ключ [скрыто] и конец",
].join("\n");

test("PN-20: text from the journal is text - <script>, <img onerror>, &lt;b&gt;, '[скрыто]', a role and a session named __proto__ show literally; nothing is created or run; the code of the page has no way to markup", async () => {
  const j = journal();
  j.sessionStart("__proto__");
  const o = j.ownerPrompt("__proto__", HOSTILE_TEXT);
  j.note({
    session_id: "__proto__",
    request_time: j.entries[o].time,
    req_id: "REQ-009",
    note_text: "<b>жирный</b> и <script>window.__x=3</script> [скрыто]",
  });
  j.post("__proto__", "tu-h", "h1", {
    subagentType: "<b>x</b>",
    description: IMG,
  });
  j.subStart("__proto__", "h1", "<b>x</b>");
  j.subStart("__proto__", "h2", "__proto__");
  const page = await loaded(j.entries);
  assert.equal(historyRowOf(page, `req:${o}`) !== null, true);
  historyRowOf(page, `req:${o}`).byClass("history-open")[0].click();
  const dom = historyDom(page);
  assert.equal(dom.isOpen(), true);

  // the text of the owner: one block, every character as written
  const quote = dom.section("request").byClass("history-quote")[0];
  assert.equal(quote.textContent, HOSTILE_TEXT);
  const masked = quote.byClass("history-masked");
  assert.equal(masked.length, 1);
  assert.equal(masked[0].textContent, "[скрыто]");
  assert.equal(
    dom.section("understood").byClass("history-quote")[0].textContent,
    "<b>жирный</b> и <script>window.__x=3</script> [скрыто]",
  );
  const text = dom.body.textContent;
  for (const s of [
    "<script>window.__x=1</script>",
    "<img src=x onerror=window.__x=2>",
    "&lt;b&gt;",
    IMG,
    "<b>x</b>",
    "__proto__",
  ]) {
    assert.ok(text.includes(s), s);
  }
  assert.equal(
    dom.title().textContent,
    "REQ-009 — <b>жирный</b> и <script>window.__x=3</script> [скрыто]",
  );
  // nothing was made of it
  assert.equal(globalThis.__x, undefined);
  assert.equal(globalThis.window?.__x, undefined);
  for (const tag of ["script", "img", "b", "i", "a", "iframe"]) {
    assert.equal(page.created(tag).length, 0, tag);
  }
  assert.equal(page.doc.htmlWrites, 0);
  assert.equal(page.doc.styleTouches, 0);
  const allowed = new Set([
    "SPAN",
    "P",
    "H2",
    "H3",
    "SECTION",
    "DIV",
    "TABLE",
    "THEAD",
    "TBODY",
    "TR",
    "TH",
    "TD",
    "OL",
    "LI",
  ]);
  for (const el of dom.body.all(() => true)) {
    assert.ok(
      allowed.has(el.tagName),
      `an element ${el.tagName} in the window`,
    );
    assert.equal(el.hasAttribute("style"), false);
  }
  assert.equal({}.session_id, undefined);
  assert.equal(Object.hasOwn(Object.prototype, "polluted"), false);
  // the table: the hostile role and description are cells of text
  const roles = dom
    .section("work")
    .byClass("history-role")
    .map((e) => e.textContent);
  assert.deepEqual(roles, ["<b>x</b>", "__proto__"]);
  assert.equal(dom.section("work").byClass("history-does")[0].textContent, IMG);

  // the code of the page: no markup APIs, no style attribute, no address but 127.0.0.1
  const files = fs
    .readdirSync(PUBLIC)
    .filter((f) => /\.(js|html|css)$/.test(f));
  for (const f of files) {
    const code = fs.readFileSync(path.join(PUBLIC, f), "utf8");
    for (const re of [
      /innerHTML/,
      /outerHTML/,
      /insertAdjacentHTML/,
      /document\.write/,
      /\beval\(/,
    ]) {
      assert.equal(re.test(code), false, `${f}: ${re}`);
    }
    assert.equal(/\sstyle\s*=/i.test(code), false, `${f}: style attribute`);
    for (const m of code.matchAll(/https?:\/\/[^\s"'`)]*/g)) {
      assert.ok(m[0].startsWith("http://127.0.0.1"), `${f}: ${m[0]}`);
    }
  }
});

function pressKey(target, key, extra = {}) {
  let prevented = 0;
  target.fire("keydown", {
    key,
    preventDefault: () => (prevented += 1),
    ...extra,
  });
  return prevented;
}

test("PN-21: the keyboard and the focus - Enter and Space open from the button of the row, Escape, the cross and the overlay close, the focus returns to the opener, Tab goes round, data-modal on the body; Escape closes only the top window; a card of an agent that is open closes when the window opens", async () => {
  const fx = twoRequests();
  const page = await loaded(fx.j.entries);
  const k1 = `req:${fx.o1}`;
  const dom = historyDom(page);
  const bodyEl = () => page.el("history-overlay").parentNode;
  const modal = () => bodyEl().getAttribute("data-modal");
  const esc = () =>
    page.doc.fire("keydown", { key: "Escape", preventDefault() {} });
  // REQ-045: the window opens from the separate button of the row; the row
  // itself (its toggle) opens the details of the event
  const row = () => historyRowOf(page, k1).byClass("history-open")[0];
  const toggle = () => historyRowOf(page, k1).byClass("row-toggle")[0];
  const focusedIs = (el, why) => assert.ok(page.doc.focused === el, why);
  assert.equal(modal(), null);

  // Enter on the toggle of the row opens the details, not the window
  pressKey(toggle(), "Enter");
  assert.equal(dom.isOpen(), false);
  assert.equal(historyRowOf(page, k1).byClass("event-details").length, 1);
  pressKey(toggle(), "Enter");
  assert.equal(historyRowOf(page, k1).byClass("event-details").length, 0);
  // Enter and Space on the button open; other keys do not
  pressKey(row(), "a");
  pressKey(row(), "Tab");
  assert.equal(dom.isOpen(), false);
  pressKey(row(), "Enter");
  assert.equal(dom.isOpen(), true);
  focusedIs(dom.close, "focus is on the cross");
  assert.equal(modal(), "history");
  assert.equal(dom.dialog.getAttribute("role"), "dialog");
  assert.equal(dom.dialog.getAttribute("aria-modal"), "true");
  // Escape closes, the focus goes back to the row, the attribute is gone
  esc();
  assert.equal(dom.isOpen(), false);
  assert.equal(modal(), null);
  assert.equal(dom.body.children.length, 0);
  focusedIs(row(), "focus is on the row");
  pressKey(row(), " ");
  assert.equal(dom.isOpen(), true);
  // the cross
  dom.close.click();
  assert.equal(dom.isOpen(), false);
  assert.equal(modal(), null);
  focusedIs(row(), "focus is on the row after the cross");
  // the overlay: a click on the window stays, a click beside it closes
  row().click();
  dom.overlay.fire("click", { target: dom.dialog });
  dom.overlay.fire("click", { target: dom.body });
  assert.equal(dom.isOpen(), true);
  dom.overlay.click({ target: dom.overlay });
  assert.equal(dom.isOpen(), false);
  focusedIs(row(), "focus is on the row after the overlay");

  // Tab goes round the cross and the body, Shift+Tab the other way
  row().click();
  focusedIs(dom.close, "start");
  assert.equal(pressKey(page.doc, "Tab") > 0, true);
  focusedIs(dom.body, "Tab: body");
  pressKey(page.doc, "Tab");
  focusedIs(dom.close, "Tab: back to the cross");
  pressKey(page.doc, "Tab", { shiftKey: true });
  focusedIs(dom.body, "Shift+Tab from the cross");
  pressKey(page.doc, "Tab", { shiftKey: true });
  focusedIs(dom.close, "Shift+Tab from the body");
  pressKey(page.doc, "a");
  focusedIs(dom.close, "another key does not move the focus");
  assert.equal(dom.isOpen(), true);
  esc();

  // the button of a card: the focus comes back to the button
  buttonOf(page, "a1").click();
  assert.equal(dom.isOpen(), true);
  assert.equal(modal(), "history");
  focusedIs(dom.close, "focus is on the cross (card)");
  esc();
  assert.equal(modal(), null);
  focusedIs(buttonOf(page, "a1"), "focus is on the button of the card");
  buttonOf(page, "a1").click();
  dom.close.click();
  focusedIs(
    buttonOf(page, "a1"),
    "the cross: focus is on the button of the card",
  );

  // the open window follows the journal and keeps the scroll and the focus
  const k2 = `req:${fx.o2}`;
  historyRowOf(page, k2).byClass("history-open")[0].click();
  const count = () => dom.section("timeline").byClass("history-event").length;
  const before = count();
  dom.body.scrollTop = 7;
  fx.j.subStart("S1", "a3", "Explore");
  await page.push(fx.j.entries[fx.j.entries.length - 1]);
  assert.equal(dom.isOpen(), true);
  assert.equal(count(), before + 1);
  assert.equal(dom.body.scrollTop, 7);
  focusedIs(dom.close, "the focus stays on the cross");
  dom.close.click();

  // one window at a time: the card of an agent closes when the window opens
  const card = page.el("card-overlay");
  const both = () => !card.hidden && dom.isOpen();
  const legend = () =>
    page.legend().find((b) => b.dataset.key === "role:Explore");
  legend().click();
  assert.equal(card.hidden, false);
  // Escape closes the card (the old behaviour) when no window is open
  esc();
  assert.equal(card.hidden, true);
  legend().click();
  assert.equal(both(), false);
  // Tab reached the button under the card: Enter on it
  buttonOf(page, "a1").click();
  assert.equal(card.hidden, true, "the card is closed");
  assert.equal(dom.isOpen(), true);
  assert.equal(both(), false);
  assert.equal(
    page
      .legend()
      .find((b) => b.dataset.key === "role:Explore")
      .getAttribute("aria-pressed"),
    "true",
    "the choice of the character stays",
  );
  // one Escape closes only the window; the card is not opened again
  esc();
  assert.equal(dom.isOpen(), false);
  assert.equal(card.hidden, true);
  assert.equal(modal(), null);
  focusedIs(buttonOf(page, "a1"), "focus is on the button after the window");
  esc();
  assert.equal(card.hidden, true);
  assert.equal(both(), false);
  // a row of the journal does the same
  legend().click();
  row().click();
  assert.equal(card.hidden, true);
  assert.equal(dom.isOpen(), true);
  esc();
  assert.equal(dom.isOpen(), false);
  assert.equal(card.hidden, true);
  focusedIs(row(), "focus is on the row");
});

test("PN-21b: Escape with nothing open does nothing - no window, no card, no data-modal", async () => {
  const fx = twoRequests();
  const page = await loaded(fx.j.entries);
  const dom = historyDom(page);
  page.doc.fire("keydown", { key: "Escape" });
  assert.equal(dom.isOpen(), false);
  assert.equal(page.el("card-overlay").hidden, true);
  assert.equal(dom.overlay.parentNode.getAttribute("data-modal"), null);
});

const ALLOWED_PX_LINES = new Set([
  "font-size: clamp(16px, min(100vw / 120, 100vh / 67.5), 24px);",
  "outline: 2px solid var(--accent);",
  "outline-offset: 2px;",
  "border-bottom: 1px solid var(--line);",
  "border: 1px solid var(--line);",
  "border: 1px solid var(--now-line);",
  "@media (min-width: 1240px) and (min-height: 640px) {",
  "@media (max-width: 599px) {",
]);

test("PN-22: the contract of the CSS of the window - the height is bound in vh, the body scrolls inside, no scroll sideways, the page under it does not scroll; sizes in rem; no px but the lines of 1 and 2 px and the thresholds; the outline of the focused row", () => {
  const css = fs.readFileSync(path.join(PUBLIC, "style.css"), "utf8");
  const rules = parseCss(css);
  const top = (sel) => cssDecls(rules, sel);
  const rem = (v) => {
    const m = /^(-?\d*\.?\d+)rem$/.exec(v ?? "");
    assert.ok(m !== null, `not in rem: ${v}`);
    return Number(m[1]);
  };

  // the window
  const win = top(".history");
  assert.match(
    win.get("max-height"),
    /\b\d+(\.\d+)?d?vh\b/,
    "the limit of the height in vh/dvh",
  );
  assert.ok(win.get("max-height").includes("3.5rem"));
  assert.equal(win.get("overflow"), "hidden");
  assert.equal(win.get("display"), "flex");
  assert.equal(win.get("flex-direction"), "column");
  assert.equal(win.get("width"), "min(55rem, 100% - 2rem)");
  assert.equal(rem(win.get("border-radius")), 0.75);
  assert.equal(win.get("margin"), "1.75rem auto 0");
  assert.equal(cssDecls(rules, ".history").get("position"), "relative");
  // the body: the only place that scrolls
  const body = top(".history-body");
  assert.equal(body.get("overflow-y"), "auto");
  assert.equal(body.get("overflow-x"), "hidden");
  assert.equal(body.get("overflow-wrap"), "anywhere");
  assert.equal(body.get("min-height"), "0");
  assert.equal(body.get("flex"), "1 1 auto");
  assert.equal(rem(body.get("padding")), 1.5);
  // the overlay does not scroll, the page under it does not either
  const overlay = top(".history-overlay");
  assert.equal(overlay.get("overflow"), "hidden");
  assert.equal(overlay.get("position"), "fixed");
  assert.equal(overlay.get("inset"), "0");
  assert.equal(top("body[data-modal]").get("overflow"), "hidden");
  assert.ok(
    Number(overlay.get("z-index")) > Number(top(".overlay").get("z-index")),
  );
  // texts keep paragraphs and wrap
  assert.equal(top(".history-quote").get("white-space"), "pre-wrap");
  assert.equal(top(".history-note-text").get("white-space"), "pre-wrap");
  // the cross: 2 rem hit area, 1.5 rem sign, 0.75 and 0.875 rem from the corner
  const cross = top(".history-close");
  assert.equal(rem(cross.get("width")), 2);
  assert.equal(rem(cross.get("height")), 2);
  assert.equal(rem(cross.get("font-size")), 1.5);
  assert.equal(rem(cross.get("top")), 0.75);
  assert.equal(rem(cross.get("right")), 0.875);
  // the table and the quote
  assert.equal(
    rem(top(".history-quote").get("border-left").split(" ")[0]),
    0.1875,
  );
  assert.equal(
    top(".history-quote").get("border-radius"),
    "0 0.4375rem 0.4375rem 0",
  );
  // the focus outline of a row (its toggle, REQ-045): inside the scrolling
  // list; the button that opens the window has the ring of every button
  assert.equal(
    top(".row-toggle:focus-visible").get("outline-offset"),
    "-0.125rem",
  );
  assert.equal(top(".row-toggle").get("cursor"), "pointer");
  assert.match(top("button:focus-visible").get("outline"), /^2px solid/);
  assert.equal(top("button:focus-visible").get("outline-offset"), "2px");

  // a narrow window: the whole screen, a bigger cross
  const narrow = "@media (max-width: 599px)";
  const nwin = cssDecls(rules, ".history", narrow);
  assert.equal(nwin.get("width"), "100%");
  assert.equal(nwin.get("height"), "100%");
  assert.equal(nwin.get("max-height"), "none");
  assert.equal(nwin.get("margin"), "0");
  assert.ok(
    rem(cssDecls(rules, ".history-close", narrow).get("width")) >= 2.75,
  );
  assert.ok(
    rem(cssDecls(rules, ".history-close", narrow).get("height")) >= 2.75,
  );
  assert.equal(rem(cssDecls(rules, ".history-body", narrow).get("padding")), 1);

  // the rules of the window have no px but the line of 1 px
  for (const rule of rules) {
    const own = rule.selectors.some((s) =>
      /history|opens-history|data-modal/.test(s),
    );
    if (!own) continue;
    for (const [name, value] of rule.decls) {
      if (!/\d\s*px/.test(value)) continue;
      assert.ok(
        name.startsWith("border") && /^1px solid /.test(value),
        `${rule.selectors[0]}: ${name}: ${value}`,
      );
    }
  }
  // no new px strings in the whole sheet
  for (const line of css.split("\n")) {
    if (!/\d\s*px/.test(line)) continue;
    if (/^\s*\/?\*/.test(line)) continue;
    assert.ok(
      ALLOWED_PX_LINES.has(line.trim()),
      `a new px line: ${line.trim()}`,
    );
  }
  // no horizontal scroll rule is lifted: nothing of the window sets overflow-x visible or scroll
  for (const rule of rules) {
    if (!rule.selectors.some((s) => /history/.test(s))) continue;
    const ox = rule.decls.get("overflow-x");
    if (ox !== undefined) assert.equal(ox, "hidden");
  }
});

// ===================================================================
// REQ-042: state honesty (design 10: FS-05 ... FS-20). "Now" is a number
// given by the test; the real clock is never read.
// ===================================================================
import { ITEM_STATES } from "../src/pixel-office/public/model.js";
import { checkLine } from "../src/pixel-office/public/schema.js";
import {
  bubblesAt,
  buildCard,
  buildOffice,
} from "../src/pixel-office/public/office-model.js";
import {
  nowLine,
  taskPanel,
  unconfirmedNote,
} from "../src/pixel-office/public/panels.js";
import {
  WORDS,
  lineAt,
  readFixture,
  startRec,
} from "./pixel-office-helpers.js";

const sub = (session, id, ms, type = "Explore") =>
  lineAt("SubagentStart", session, ms, { agent_id: id, agent_type: type });
const subEnd = (session, id, ms, type = "Explore") =>
  lineAt("SubagentStop", session, ms, { agent_id: id, agent_type: type });
const tool = (session, ms, id = "tu-x") =>
  lineAt("PostToolUse", session, ms, {
    tool_use_id: id,
    launched_agent_id: "nobody",
  });
const HOUR = 3600 * 1000;
const sectionOf = (page, item) => {
  let section = null;
  for (const c of page.el("tasks").children) {
    if (c.classes.has("section-title")) section = c.dataset.section;
    if (c === item) return section;
  }
  return null;
};
const itemsIn = (page, name) =>
  page.items().filter((i) => sectionOf(page, i) === name);
const keysIn = (page, name) => itemsIn(page, name).map((i) => i.dataset.key);
const wordOf = (item) => item.byClass("item-state")[0].textContent;
const legendState = (page, key) =>
  page
    .legend()
    .find((b) => b.dataset.key === key)
    .byClass("state")[0].textContent;
// ------------------------------------------------------------------ FS-08

test("FS-08: the panels at two moments of one sequence - on the border the item is in 'Текущие' and in 'Сейчас', one millisecond later it stands in 'История' with its word, 'Сейчас' counts it, no session runs; the same for 'сервер перезапускался…'; 'окончание не записано' is not counted", async () => {
  const entries = [
    lineAt("SessionStart", "S1", T0),
    lineAt("UserPromptSubmit", "S1", T0 + 500),
    sub("S1", "a1", T0 + 1000),
  ];
  const last = T0 + 1000;
  const page = await loaded(entries, [], { now: last + STALE_AFTER_MS });
  assert.deepEqual(keysIn(page, "current"), ["a1", "main:1"]);
  assert.deepEqual(keysIn(page, "history"), []);
  // REQ-036: one row per item in the order of "Текущие"
  assert.deepEqual(nowRows(page), [
    "Explore",
    "Основная сессия — обрабатывает запрос",
  ]);
  assert.deepEqual(nowKinds(page), ["task", "main"]);
  assert.equal(page.el("now").dataset.busy, "true");
  assert.equal(page.el("now").dataset.unconfirmed, "false");
  assert.equal(
    cardsOf(page).filter((c) => c.dataset.running === "true").length,
    1,
  );
  assert.equal(page.el("tasks").byClass("unconfirmed-note").length, 0);

  // the same journal one millisecond later (a page opened at that moment; the
  // planned recalculation itself is tested by FS-05 and FS-10)
  const later = await loaded(entries, [], {
    now: last + STALE_AFTER_MS + 1,
  });
  assert.deepEqual(keysIn(later, "current"), []);
  assert.deepEqual(keysIn(later, "history"), ["a1", "main:1"]);
  for (const item of itemsIn(later, "history")) {
    assert.equal(wordOf(item), WORDS.stale);
  }
  assert.equal(
    later.text("now-text"),
    "Сейчас: в работе ничего нет · без свежих данных: 2",
  );
  assert.equal(later.el("now").dataset.busy, "false");
  assert.equal(later.el("now").dataset.unconfirmed, "true");
  assert.equal(
    cardsOf(later).filter((c) => c.dataset.running === "true").length,
    0,
    "no session runs",
  );
  assert.equal(later.el("tasks").byClass("unconfirmed-note").length, 1);
  // the first section holds the empty line
  assert.equal(
    later.el("tasks").byClass("section-empty")[0].textContent,
    "в работе ничего нет",
  );
  assert.equal(legendState(later, "role:Explore"), "свободен");
  assert.equal(legendState(later, "main"), "свободна");
  // the word about the restart: the same placement, the same N
  const restarted = await loaded(entries, [startRec(3, T0 + 2000)], {
    now: last + 1000,
  });
  assert.deepEqual(keysIn(restarted, "current"), []);
  assert.deepEqual(keysIn(restarted, "history"), ["a1", "main:1"]);
  for (const item of itemsIn(restarted, "history")) {
    assert.equal(wordOf(item), WORDS.restarted);
  }
  assert.equal(
    restarted.text("now-text"),
    "Сейчас: в работе ничего нет · без свежих данных: 2",
  );
  assert.equal(legendState(restarted, "role:Explore"), "свободен");

  // 'окончание не записано' stands in the history and is not in N
  const ended = await loaded(
    [...entries, lineAt("SessionEnd", "S1", T0 + 2000)],
    [],
    { now: last + 1000 },
  );
  assert.deepEqual(keysIn(ended, "current"), []);
  for (const item of itemsIn(ended, "history")) {
    assert.equal(wordOf(item), WORDS.unrecorded);
  }
  assert.equal(ended.text("now-text"), "Сейчас: в работе ничего нет");
  assert.equal(ended.el("tasks").byClass("unconfirmed-note").length, 0);
  assert.equal(legendState(ended, "role:Explore"), "свободен");
});

// ------------------------------------------------------------------ FS-09

test("FS-09: a session 'Идёт' only with fresh data - fresh and old sessions, SessionEnd (also older than the threshold), a fresh session whose last event is before the server start; no bar and no 'n/m' on any card, nowhere in the code", async () => {
  const entries = [
    // S1: the last event is inside the threshold
    lineAt("SessionStart", "S1", T0),
    sub("S1", "a1", T0 + 1000),
    // S2: silent for longer than the threshold
    lineAt("SessionStart", "S2", T0 + 2000),
    sub("S2", "b1", T0 + 3000, "Plan"),
    // S3: ended by SessionEnd long ago
    lineAt("SessionStart", "S3", T0 + 4000),
    sub("S3", "c1", T0 + 5000, "Explore"),
    lineAt("SessionEnd", "S3", T0 + 6000),
  ];
  // S1 gets a later event so that it stays fresh
  const now = T0 + 2 * HOUR;
  entries.push(tool("S1", now - 5 * 60 * 1000));
  const page = await loaded(entries, [], { now });
  const cards = cardsOf(page);
  const m = page.app.getModel();
  const word = (sid) => m.sessions.find((s) => s.session_id === sid).word;
  assert.equal(word("S1"), "running");
  assert.equal(word("S2"), "stale");
  assert.equal(
    word("S3"),
    null,
    "SessionEnd older than the threshold: no word",
  );
  assert.equal(m.sessions.filter((s) => s.running).length, 1);
  // on the page
  assert.equal(cards.filter((c) => c.dataset.running === "true").length, 1);
  const running = cards.find((c) => c.dataset.running === "true");
  assert.equal(running.byClass("session-badge")[0].textContent, "• Идёт");
  const stale = cards.filter((c) => c.dataset.word === "stale");
  assert.equal(stale.length, 1);
  assert.equal(
    stale[0].byClass("session-badge")[0].textContent,
    "нет свежих данных",
  );
  assert.equal(stale[0].dataset.running, "false");
  const ended = cards.filter((c) => c.dataset.word === undefined);
  assert.equal(ended.length, 1);
  assert.equal(ended[0].byClass("session-badge").length, 0);
  assert.equal(ended[0].textContent.includes("Идёт"), false);
  assert.equal(ended[0].textContent.includes("нет свежих данных"), false);
  // a fresh session whose last event is before the last start of the server
  const quiet = [lineAt("SessionStart", "Q", T0), sub("Q", "q1", T0 + 1000)];
  const q = await loaded(quiet, [startRec(2, T0 + 2000)], { now: T0 + 5000 });
  const qm = q.app.getModel();
  assert.equal(qm.sessions[0].word, null);
  assert.equal(qm.sessions[0].running, false);
  assert.equal(qm.sessions[0].age_ms < STALE_AFTER_MS, true);
  const qc = cardsOf(q);
  assert.equal(qc.length, 1);
  assert.equal(qc[0].dataset.running, "false");
  assert.equal(qc[0].byClass("session-badge").length, 0);
  // the same session, but the clock is far away: before the start of the
  // server and older than the threshold - the word is 'нет свежих данных'
  const far = await loaded(quiet, [startRec(2, T0 + 2000)], {
    now: T0 + 2 * HOUR,
  });
  assert.equal(far.app.getModel().sessions[0].word, "stale");
  assert.equal(far.app.getModel().sessions[0].running, false);
  const fc = cardsOf(far);
  assert.equal(fc.length, 1);
  assert.equal(fc[0].dataset.word, "stale");
  assert.equal(
    fc[0].byClass("session-badge")[0].textContent,
    "нет свежих данных",
  );
  // no bar and no 'n/m' on any card
  for (const card of [...cards, ...qc, ...fc]) {
    assert.equal(card.all((e) => e.tagName === "PROGRESS").length, 0);
    assert.doesNotMatch(card.textContent, /задач|ролей/);
  }
  // nowhere in the code of Pixel Office
  const OLD =
    /SESSION_STATS|sessionStats|session-progress|session-stats|"progress"/;
  const hits = [];
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir)) {
      const file = path.join(dir, name);
      if (fs.statSync(file).isDirectory()) walk(file);
      else if (OLD.test(fs.readFileSync(file, "utf8"))) hits.push(file);
    }
  };
  walk(path.join(PUBLIC, ".."));
  assert.deepEqual(hits, []);
  assert.equal(
    OLD.test('const p = "progress";'),
    true,
    "the expression sees it",
  );
});

// ------------------------------------------------------------------ FS-10

const MIN = 60 * 1000;

test("FS-10: the format of the age - the nine rows of the criterion (literals), minutes rounded down, nothing else in the text; no age for the one who finished or for the restart; the age grows without new lines", async () => {
  const table = [
    [0, "меньше минуты назад"],
    [59_999, "меньше минуты назад"],
    [60_000, "1 мин назад"],
    [59 * MIN + 59_000, "59 мин назад"],
    [60 * MIN, "1 ч назад"],
    [61 * MIN, "1 ч 1 мин назад"],
    [23 * HOUR + 59 * MIN, "23 ч 59 мин назад"],
    [24 * HOUR, "1 сут назад"],
    [50 * HOUR + 30 * MIN, "2 сут 2 ч назад"],
  ];
  for (const [ms, text] of table) assert.equal(ageText(ms), text, `${ms} ms`);
  // rounding down: a second before the next minute, hour and day
  assert.equal(ageText(2 * MIN - 1), "1 мин назад");
  assert.equal(ageText(HOUR + 2 * MIN - 1), "1 ч 1 мин назад");
  assert.equal(ageText(24 * HOUR + HOUR - 1), "1 сут назад");
  assert.equal(ageText(47 * HOUR + 59 * MIN), "1 сут 23 ч назад");
  // what cannot be said is not said
  assert.equal(ageText(Number.NaN), "");
  assert.equal(ageText(undefined), "");
  assert.equal(ageText(-5000), "меньше минуты назад", "negative is zero");
  assert.doesNotMatch(ageText(-5000), /NaN|-/);

  // on the page: the age is next to the last event of 'в работе' and of
  // 'нет свежих данных', not next to the one who finished or the restart
  // S3 starts first and the server restarts after it (the record stands
  // between the lines); the rest starts later
  const now = T0 + 5 * HOUR;
  const ordered = [
    lineAt("SessionStart", "S3", T0),
    sub("S3", "boot", T0 + 1000),
    lineAt("SessionStart", "S4", T0 + 2000),
    sub("S4", "old", T0 + 3000),
    lineAt("SessionStart", "S1", T0 + 4000),
    sub("S1", "run", T0 + 5000),
    lineAt("SessionStart", "S2", T0 + 6000),
    sub("S2", "done", T0 + 7000),
    subEnd("S2", "done", T0 + 8000),
    // S1 keeps working: its last event is 5 minutes ago
    tool("S1", now - 5 * MIN, "tu-keep"),
  ];
  // the record stands after the first two lines; S4 is silent since long
  const starts = [startRec(2, T0 + 1500)];
  const page = await loaded(ordered, starts, { now });
  const by = (key) => page.items().find((i) => i.dataset.key === key);
  assert.equal(by("run").dataset.state, "in_progress");
  assert.equal(by("run").byClass("age")[0].textContent, "5 мин назад");
  assert.equal(by("old").dataset.state, "stale");
  assert.equal(by("old").byClass("age")[0].textContent, "4 ч 59 мин назад");
  assert.equal(by("done").dataset.state, "completed");
  assert.equal(by("done").byClass("age").length, 0);
  assert.equal(by("boot").dataset.state, "restarted");
  assert.equal(by("boot").byClass("age").length, 0);
  // next to the time of the last event, nothing but the text of the age
  for (const key of ["run", "old"]) {
    const age = by(key).byClass("age")[0];
    assert.equal(age.children.length, 0);
    assert.match(age.textContent, /^[0-9а-я ]+ назад$/);
  }
  assert.doesNotMatch(page.text("tasks"), /NaN/);

  // the age grows by itself: 60 s of the page clock, no new lines
  const calls = page.server.entries.length;
  await page.tick(60_000);
  assert.equal(page.server.entries.length, calls);
  assert.equal(by("run").byClass("age")[0].textContent, "6 мин назад");
  assert.equal(by("old").byClass("age")[0].textContent, "5 ч назад");
  // and on the card of the session
  const card = cardsOf(page).find((c) => c.dataset.word === "running");
  assert.equal(card.byClass("age")[0].textContent, "6 мин назад");
});

// ------------------------------------------------------------------ FS-11

const own = (session, ms, text) =>
  lineAt("UserPromptSubmit", session, ms, {
    prompt_kind: "owner",
    prompt_text: text,
  });

// One task of the role Explore in each of the five states.
function fiveStates() {
  const now = T0 + 5 * HOUR;
  const entries = [
    // a5: started, then the server restarted
    lineAt("SessionStart", "S5", T0),
    own("S5", T0 + 500, "Образец запроса пять"),
    sub("S5", "a5", T0 + 1000),
    // (the record of the server start stands here: journal_lines 3)
    // a2: the session is silent for hours
    lineAt("SessionStart", "S2", T0 + 2000),
    own("S2", T0 + 2500, "Образец запроса два"),
    sub("S2", "a2", T0 + 3000),
    // a4: the session ended
    lineAt("SessionStart", "S4", T0 + 4000),
    own("S4", T0 + 4500, "Образец запроса четыре"),
    sub("S4", "a4", T0 + 5000),
    lineAt("SessionEnd", "S4", T0 + 6000),
    // a1 works, a3 has finished: a fresh session
    lineAt("SessionStart", "S1", now - 5 * MIN),
    own("S1", now - 5 * MIN + 500, "Образец запроса один"),
    sub("S1", "a1", now - 5 * MIN + 1000),
    sub("S1", "a3", now - 5 * MIN + 2000),
    subEnd("S1", "a3", now - 5 * MIN + 3000),
  ];
  return { entries, starts: [startRec(3, T0 + 1500)], now };
}

test("FS-11: the five words - in the panel, in the card of the agent (in the sections of the states; 'окончание не записано' only in its own section) and in the window of history each equals the literal of the criterion", async () => {
  const { entries, starts, now } = fiveStates();
  const page = await loaded(entries, starts, { now });
  const want = {
    a1: "in_progress",
    a2: "stale",
    a3: "completed",
    a4: "unrecorded",
    a5: "restarted",
  };
  // the model first: the five states, one task each
  const m = page.app.getModel();
  for (const [key, state] of Object.entries(want)) {
    assert.equal(m.tasks.find((t) => t.key === key).state, state, key);
  }
  assert.deepEqual(
    [...new Set(Object.values(want))].sort(),
    [...ITEM_STATES].sort(),
  );
  // the panel
  for (const [key, state] of Object.entries(want)) {
    const item = page.items().find((i) => i.dataset.key === key);
    assert.equal(item.dataset.state, state, key);
    assert.equal(wordOf(item), WORDS[state], `panel ${key}`);
  }
  // the card of the agent: sections and words
  page
    .legend()
    .find((b) => b.dataset.key === "role:Explore")
    .click();
  const section = (name) =>
    page.el("card").all((e) => e.dataset.list === name)[0];
  const inSection = (name) =>
    section(name)
      .byClass("item")
      .map((i) => [i.dataset.key, wordOf(i)]);
  assert.deepEqual(inSection("in-progress"), [["a1", WORDS.in_progress]]);
  // the order of the list: the newer start on top
  assert.deepEqual(inSection("unconfirmed"), [
    ["a2", WORDS.stale],
    ["a5", WORDS.restarted],
  ]);
  assert.deepEqual(inSection("recent-completed"), [["a3", WORDS.completed]]);
  assert.deepEqual(inSection("unrecorded"), [["a4", WORDS.unrecorded]]);
  assert.equal(
    section("unrecorded").byClass("tasks-note").length,
    0,
    "nothing is cut: no note",
  );
  // the headings of the sections are words of the page, not of success
  assert.deepEqual(
    ["in-progress", "unconfirmed", "recent-completed", "unrecorded"].map(
      (n) => section(n).children[0].textContent,
    ),
    [
      "Сейчас в работе",
      "Нет подтверждения работы",
      "Недавно закончили работу",
      "Окончание не записано",
    ],
  );
  // the window of history: the word of the task in its table
  for (const [key, state] of Object.entries(want)) {
    const item = page.items().find((i) => i.dataset.key === key);
    item.byClass("history-open")[0].click();
    const dom = historyDom(page);
    assert.equal(dom.isOpen(), true, key);
    const row = dom.body.find(
      (e) => e.tagName === "TR" && e.dataset.key === key,
    );
    assert.equal(
      row.byClass("history-state")[0].textContent,
      WORDS[state],
      key,
    );
    assert.equal(row.dataset.state, state);
    dom.close.click();
    assert.equal(dom.isOpen(), false);
  }
});

test("FS-11: the card of the agent cuts the sections 'Нет подтверждения работы' at 10 and 'Окончание не записано' at 5 and says 'показано n из N' under each; the number of all is the true one", async () => {
  const entries = [lineAt("SessionStart", "OLD", T0)];
  for (let i = 0; i < 12; i++) entries.push(sub("OLD", `s${i}`, T0 + 100 + i));
  entries.push(lineAt("SessionStart", "END", T0 + 1000));
  for (let i = 0; i < 7; i++) entries.push(sub("END", `u${i}`, T0 + 1100 + i));
  entries.push(lineAt("SessionEnd", "END", T0 + 2000));
  const page = await loaded(entries, [], { now: T0 + 3 * HOUR });
  const m = page.app.getModel();
  const card = buildCard(m, buildOffice(m), "role:Explore");
  assert.equal(card.unconfirmed.length, 10);
  assert.equal(card.unconfirmed_total, 12);
  assert.equal(card.unrecorded.length, 5);
  assert.equal(card.unrecorded_total, 7);
  page
    .legend()
    .find((b) => b.dataset.key === "role:Explore")
    .click();
  const section = (name) =>
    page.el("card").all((e) => e.dataset.list === name)[0];
  assert.equal(section("unconfirmed").byClass("item").length, 10);
  assert.equal(
    section("unconfirmed").byClass("tasks-note")[0].textContent,
    "показано 10 из 12",
  );
  assert.equal(section("unrecorded").byClass("item").length, 5);
  assert.equal(
    section("unrecorded").byClass("tasks-note")[0].textContent,
    "показано 5 из 7",
  );
  assert.equal(section("in-progress").byClass("tasks-note").length, 0);
  assert.equal(section("recent-completed").byClass("tasks-note").length, 0);
  // 'окончание не записано' is not in the family of 'нет подтверждения'
  assert.equal(
    section("unconfirmed")
      .byClass("item")
      .every((i) => i.dataset.state === "stale"),
    true,
  );
  assert.equal(
    section("unrecorded")
      .byClass("item")
      .every((i) => i.dataset.state === "unrecorded"),
    true,
  );
});

// ------------------------------------------------------------------ FS-13

const SUCCESS_WORDS = /заверш|готов|выполнен|успешн/i;

test("FS-13: no words of success on the page - in a scenario with all five states the card, the legend, the panel, the journal, the line 'Сейчас', the board and the bubbles do not match заверш|готов|выполнен|успешн; the bubbles are the two literals of the criterion", async () => {
  const { entries, starts, now } = fiveStates();
  // the fresh session also answers: Stop of the main session
  const stopMs = now - 5 * MIN + 4000;
  const all = [...entries, lineAt("Stop", "S1", stopMs)];
  const page = await loaded(all, starts, { now: stopMs + 1000 });
  const bubbles = [...bubblesAtOf(page).values()].map((b) => b.text);
  assert.deepEqual(bubbles.sort(), ["Вернул ответ", "Закончил работу"].sort());
  const seen = [];
  const take = (label, text) => seen.push([label, text]);
  take("now", page.text("now-text"));
  take("title", page.el("now").title);
  take("tasks", page.text("tasks"));
  take("journal", page.text("journal"));
  take("legend", page.text("legend"));
  for (const key of ["role:Explore", "main"]) {
    page
      .legend()
      .find((b) => b.dataset.key === key)
      .click();
    take(`card ${key}`, page.text("card"));
  }
  page.ctx.clear();
  page.frames.step();
  for (const c of page.ctx.lastFrame()) {
    if (c.op === "fillText") take("canvas", String(c.args[0]));
  }
  // the texts of the canvas include the board plaques and the bubbles
  const canvas = seen.filter(([l]) => l === "canvas").map(([, t]) => t);
  assert.ok(canvas.includes("Вернул ответ"));
  assert.ok(canvas.includes("Закончил работу"));
  for (const [label, text] of seen) {
    assert.doesNotMatch(text, SUCCESS_WORDS, label);
  }
  // the window of history: the only exception is the caption of the time of
  // the last Stop (HISTORY_META_FINISHED)
  const done = page.items().find((i) => i.dataset.key === "a3");
  done.byClass("history-open")[0].click();
  const dom = historyDom(page);
  const without = dom.body
    .all((e) => e.children.length === 0 && !e.classes.has("history-finished"))
    .map((e) => e.textContent)
    .join(" ");
  assert.doesNotMatch(without, SUCCESS_WORDS);
  const named = dom.body.byClass("history-finished");
  assert.ok(named.length <= 1);
  for (const e of named) assert.match(e.textContent, /^завершён /);
  // the expression: the old words are seen, the new ones are not
  for (const old of [
    "завершена",
    "Недавно завершены",
    "Готово",
    "Ответ готов",
  ]) {
    assert.match(old, SUCCESS_WORDS, old);
  }
  for (const word of Object.values(WORDS))
    assert.doesNotMatch(word, SUCCESS_WORDS);
});

function bubblesAtOf(page) {
  return bubblesAt(page.app.getOffice(), page.clock.now());
}

// ------------------------------------------------------------------ FS-14

const SAMPLE_STALE_NOW = Date.parse("2026-09-20T12:35:00.000Z");
const SAMPLE_SHORT_NOW = Date.parse("2026-09-20T10:04:00.000Z");
const SAMPLE_RESTART = { time: "2026-09-20T10:01:00.000Z", journal_lines: 2 };

test("FS-14: the panels on the sample - D1 (the silent task is not in 'Сейчас', 'Текущие' or on the desk), D2 (one session of two runs), D3 (no bar, no 'n/m'), D5 ('Сейчас: в работе ничего нет · без свежих данных: 1', the reason named), and the control", async () => {
  const sample = (name) => readFixture(name).entries;
  for (const name of [
    "events-stale.jsonl",
    "events-restart.jsonl",
    "events-fresh.jsonl",
  ]) {
    for (const e of sample(name)) assert.equal(checkLine(e, true).ok, true);
  }

  // D1, D2, D3
  const page = await loaded(sample("events-stale.jsonl"), [], {
    now: SAMPLE_STALE_NOW,
  });
  assert.deepEqual(keysIn(page, "current"), [
    "sample-a3",
    "sample-a2",
    "main:5",
  ]);
  assert.deepEqual(keysIn(page, "history"), ["sample-a1", "main:1"]);
  assert.ok(!page.text("now-text").includes("Explore"), "not in 'Сейчас'");
  // REQ-036: three rows in the order of "Текущие", Explore not among them
  assert.deepEqual(
    page
      .el("now")
      .all((e) => e.classes.has("now-row"))
      .map((r) => r.dataset.key),
    ["sample-a3", "sample-a2", "main:5"],
  );
  assert.deepEqual(nowRows(page), [
    "general-purpose",
    "Plan — Образец: план работ",
    "Основная сессия — обрабатывает запрос",
  ]);
  assert.equal(legendState(page, "role:Explore"), "свободен");
  assert.equal(legendState(page, "role:Plan"), "работает");
  assert.equal(legendState(page, "role:general-purpose"), "работает");
  assert.equal(
    page.app.getOffice().board.columns.some((c) => c.key === "role:Explore"),
    false,
  );
  const cards = cardsOf(page);
  assert.equal(cards.filter((c) => c.dataset.running === "true").length, 1);
  const silent = cards.find((c) => c.dataset.word === "stale");
  assert.equal(silent.byClass("age")[0].textContent, "2 ч 34 мин назад");
  for (const card of cards) {
    assert.equal(card.all((e) => e.tagName === "PROGRESS").length, 0);
    assert.doesNotMatch(card.textContent, /задач|ролей|\d+\/\d+/);
  }
  // the panel carries the explanation next to the line 'Сейчас' only if
  // nothing is in progress: here something is
  assert.equal(page.el("tasks").byClass("unconfirmed-note").length, 0);

  // D5: the agent started, the server restarted, the session has a fresh event
  const p5 = await loaded(sample("events-restart.jsonl"), [SAMPLE_RESTART], {
    now: SAMPLE_SHORT_NOW,
  });
  assert.equal(
    p5.text("now-text"),
    "Сейчас: в работе ничего нет · без свежих данных: 1",
  );
  assert.ok(p5.el("now").title.includes(fmtDateTime(SAMPLE_RESTART.time)));
  const note = p5.el("tasks").byClass("unconfirmed-note");
  assert.equal(note.length, 1);
  assert.equal(note[0].textContent, p5.el("now").title);
  assert.equal(wordOf(p5.items()[0]), WORDS.restarted);
  assert.deepEqual(keysIn(p5, "current"), []);
  assert.equal(legendState(p5, "role:Explore"), "свободен");
  assert.equal(
    cardsOf(p5).filter((c) => c.dataset.running === "true").length,
    1,
    "the session itself has a fresh event",
  );

  // the control: fresh events, no restart
  const pc = await loaded(sample("events-fresh.jsonl"), [], {
    now: SAMPLE_SHORT_NOW,
  });
  assert.deepEqual(keysIn(pc, "current"), ["sample-a5"]);
  assert.equal(wordOf(pc.items()[0]), WORDS.in_progress);
  assert.equal(
    pc.text("now-text"),
    "Сейчас: Plan — Образец: контрольная задача",
  );
  assert.equal(pc.el("tasks").byClass("unconfirmed-note").length, 0);
  assert.equal(legendState(pc, "role:Plan"), "работает");
});

// ------------------------------------------------------------------ FS-17

const LEAD =
  "Журнал не подтверждает, что эти задачи и строки основной сессии идут. Это не конец работы и не ошибка.";

test("FS-17: the line 'Сейчас' without confirmation - empty, two silent items (the age of the older one in the title), one restart (the time of the start), one of each (both reasons), 'окончание не записано' (nothing), 301 items (N = 301), a return of an item, 'в работе' beside 'нет свежих данных' (no second part); the text of the second part and the title are one", async () => {
  const nowMs = T0 + 4 * HOUR;
  // 1. nothing: no second part
  const empty = await loaded([lineAt("SessionStart", "S0", nowMs - MIN)], [], {
    now: nowMs,
  });
  assert.equal(empty.text("now-text"), "Сейчас: в работе ничего нет");
  assert.equal(empty.el("now").title, "Сейчас: в работе ничего нет");
  assert.equal(empty.el("now").dataset.unconfirmed, "false");
  assert.equal(empty.el("tasks").byClass("unconfirmed-note").length, 0);
  assert.equal(unconfirmedNote(empty.app.getModel()), null);

  // 2. two silent items in two sessions: the older age is named
  const two = [
    lineAt("SessionStart", "S1", T0),
    sub("S1", "a1", T0 + 1000),
    lineAt("SessionStart", "S2", T0 + HOUR),
    sub("S2", "a2", T0 + HOUR + 1000, "Plan"),
  ];
  const p2 = await loaded(two, [], { now: T0 + 3 * HOUR + 2000 });
  assert.equal(
    p2.text("now-text"),
    "Сейчас: в работе ничего нет · без свежих данных: 2",
  );
  assert.equal(
    p2.el("now").title,
    `${LEAD} Нет свежих данных: 2. У самого старого последнее событие было 3 ч назад.`,
  );
  assert.equal(p2.el("now").dataset.unconfirmed, "true");
  assert.equal(
    p2.el("tasks").byClass("unconfirmed-note")[0].textContent,
    p2.el("now").title,
  );
  // the note stands over the history and below 'Текущие'
  const kids = p2.el("tasks").children;
  const noteAt = kids.findIndex((c) => c.classes.has("unconfirmed-note"));
  assert.ok(kids[noteAt - 1].classList.contains("section-empty"));
  assert.equal(kids[noteAt + 1].dataset.section, "history");

  // 3. one restart: N = 1, the time of the last start of the server
  const restartRec = startRec(2, T0 + 1500);
  const p3 = await loaded(two.slice(0, 2), [restartRec], { now: T0 + 2000 });
  assert.equal(
    p3.text("now-text"),
    "Сейчас: в работе ничего нет · без свежих данных: 1",
  );
  assert.equal(
    p3.el("now").title,
    `${LEAD} Сервер перезапускался, события не записывались: 1. Последний запуск сервера: ${fmtDateTime(restartRec.time)}.`,
  );

  // 4. one of each: N = 2, both reasons; the restart record stands between
  const both = [
    two[0],
    two[1],
    two[2],
    sub("S2", "a2", T0 + HOUR + 1000, "Plan"),
  ];
  const p4 = await loaded(both, [startRec(2, T0 + 1500)], {
    now: T0 + 3 * HOUR + 1000,
  });
  assert.equal(
    p4.text("now-text"),
    "Сейчас: в работе ничего нет · без свежих данных: 2",
  );
  assert.equal(
    p4.el("now").title,
    `${LEAD} Нет свежих данных: 1. У самого старого последнее событие было 2 ч назад. Сервер перезапускался, события не записывались: 1. Последний запуск сервера: ${fmtDateTime(restartRec.time)}.`,
  );

  // 5. one 'окончание не записано': no second part, no reason
  const ended = [
    lineAt("SessionStart", "S1", T0),
    sub("S1", "a1", T0 + 1000),
    lineAt("SessionEnd", "S1", T0 + 2000),
  ];
  const p5 = await loaded(ended, [], { now: T0 + 3000 });
  assert.equal(p5.text("now-text"), "Сейчас: в работе ничего нет");
  assert.equal(p5.el("now").dataset.unconfirmed, "false");
  assert.equal(p5.el("tasks").byClass("unconfirmed-note").length, 0);
  assert.equal(p5.app.getModel().unconfirmed.count, 0);

  // 7. a new trusted line of the session of a silent item: N falls, the item
  // returns, the second part is gone when none is left
  const p7 = await loaded(two, [], { now: T0 + 3 * HOUR + 2000 });
  p7.server.entries.push(tool("S1", p7.clock.now(), "tu-back"));
  await p7.tick(2000);
  assert.equal(p7.app.getModel().unconfirmed.count, 1);
  assert.equal(
    p7.items().find((i) => i.dataset.key === "a1").dataset.state,
    "in_progress",
  );
  assert.ok(
    p7.text("now-text").startsWith("Сейчас: Explore"),
    p7.text("now-text"),
  );
  assert.ok(!p7.text("now-text").includes("без свежих данных"));
  // 8. an item in progress beside an item without fresh data: no second part
  assert.equal(p7.el("tasks").byClass("unconfirmed-note").length, 0);
  assert.equal(p7.el("now").dataset.unconfirmed, "false");
  assert.equal(p7.el("now").title, p7.text("now-text"));
  assert.equal(p7.app.getModel().unconfirmed.stale, 1, "the model still knows");
  p7.server.entries.push(tool("S2", p7.clock.now(), "tu-back2"));
  await p7.tick(2000);
  assert.equal(p7.app.getModel().unconfirmed.count, 0);
  assert.equal(p7.el("tasks").byClass("unconfirmed-note").length, 0);
  assert.equal(unconfirmedNote(p7.app.getModel()), null);

  // 9. the texts are constants of texts.js
  assert.equal(TX.NOW_UNCONFIRMED, " · без свежих данных: {n}");
  assert.equal(TX.UNCONFIRMED_LEAD, LEAD);
  assert.equal(TX.UNCONFIRMED_STALE, "Нет свежих данных: {n}.");
  assert.equal(
    TX.UNCONFIRMED_STALE_AGE,
    "У самого старого последнее событие было {age}.",
  );
  assert.equal(
    TX.UNCONFIRMED_RESTART,
    "Сервер перезапускался, события не записывались: {n}. Последний запуск сервера: {time}.",
  );
});

test("FS-17: 301 items of both kinds - N = 301, not the 300 that the panel shows; the panel says 'показано 300 из 301'", async () => {
  const entries = [lineAt("SessionStart", "R", T0)];
  for (let i = 0; i < 151; i++) entries.push(sub("R", `r${i}`, T0 + 10 + i));
  const cut = entries.length;
  entries.push(lineAt("SessionStart", "O", T0 + 1000));
  for (let i = 0; i < 150; i++) entries.push(sub("O", `o${i}`, T0 + 1100 + i));
  const page = await loaded(entries, [startRec(cut, T0 + 900)], {
    now: T0 + 5 * HOUR,
  });
  const m = page.app.getModel();
  assert.equal(m.unconfirmed.restarted, 151);
  assert.equal(m.unconfirmed.stale, 150);
  assert.equal(m.unconfirmed.count, 301);
  assert.equal(page.items().length, 300, "the panel shows 300");
  assert.equal(
    page.text("now-text"),
    "Сейчас: в работе ничего нет · без свежих данных: 301",
  );
  assert.equal(
    page.el("tasks").byClass("tasks-note")[0].textContent,
    "показано 300 из 301",
  );
  assert.match(page.el("now").title, /Нет свежих данных: 150\./);
  assert.match(
    page.el("now").title,
    /Сервер перезапускался, события не записывались: 151\./,
  );
});

test("FS-17: stale items without a readable age - the explanation names the count and no age, no 'undefined', one sentence; a restart without a readable time of the start names no time", () => {
  const bad = [
    lineAt("SessionStart", "S1", T0),
    { ...sub("S1", "a1", T0 + 1000), time: "garbled" },
  ];
  const m = buildModel(bad, [], T0 + 2000);
  assert.equal(m.unconfirmed.stale, 1);
  assert.equal(m.unconfirmed.oldest_stale_age_ms, null);
  const note = unconfirmedNote(m);
  assert.equal(note.text, `${LEAD} Нет свежих данных: 1.`);
  assert.equal(
    nowLine(m).text,
    "Сейчас: в работе ничего нет · без свежих данных: 1",
  );
  assert.equal(nowLine(m).title, note.text);
  // a record of the start whose time cannot be read: no phrase with the time
  const ok = [lineAt("SessionStart", "S1", T0), sub("S1", "a1", T0 + 1000)];
  const m2 = buildModel(ok, [{ time: "never", journal_lines: 2 }], T0 + 2000);
  assert.equal(m2.unconfirmed.restarted, 1);
  assert.doesNotMatch(unconfirmedNote(m2).text, /undefined|NaN|Invalid/);
  assert.equal(taskPanel(m2).unconfirmed_note.restarted, 1);
});

// ------------------------------------------------------------------ FS-20

// WCAG 2.x contrast ratio of two colours given as #rrggbb, with the second
// possibly a rgba() over a base colour.
function lum([r, g, b]) {
  const f = (v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function rgbOf(text, tokens, base = null) {
  let t = text.trim();
  const v = /^var\((--[a-z0-9-]+)\)$/.exec(t);
  if (v) t = tokens.get(v[1]);
  let m = /^#([0-9a-f]{6})$/i.exec(t);
  if (m) {
    return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
  }
  m = /^rgba\((\d+), (\d+), (\d+), ([0-9.]+)\)$/.exec(t);
  assert.ok(m, `colour ${text}`);
  const a = Number(m[4]);
  return [1, 2, 3].map((i, k) =>
    Math.round(Number(m[i]) * a + base[k] * (1 - a)),
  );
}
const ratio = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

test("FS-20: the grey labels of the new states are readable - the text of the label of a session, of an item and of the window of history against its background is at least 4.5:1 by the WCAG formula, on the tokens of style.css (this is a computed property of the colours, not a search for a word)", () => {
  const css = fs.readFileSync(path.join(PUBLIC, "style.css"), "utf8");
  const rules = parseCss(css);
  const tokens = new Map(
    [...cssDecls(rules, ":root")].filter(([k]) => k.startsWith("--")),
  );
  assert.ok(
    tokens.get("--text") && tokens.get("--idle") && tokens.get("--panel"),
  );
  const cases = [
    // [selector, the surfaces under it]
    [`.session-badge[data-state="stale"]`, [null]],
    [`.item[data-state="stale"] .item-state`, ["--panel", "--panel-2"]],
    [`.item[data-state="restarted"] .item-state`, ["--panel", "--panel-2"]],
    [`.history-state[data-state="stale"]`, ["--panel", "--panel-2"]],
    [`.history-state[data-state="restarted"]`, ["--panel", "--panel-2"]],
  ];
  for (const [selector, surfaces] of cases) {
    const d = cssDecls(rules, selector);
    assert.ok(d.get("color"), `${selector}: color`);
    const bg = d.get("background");
    assert.ok(bg, `${selector}: background`);
    for (const surface of surfaces) {
      const base = surface === null ? null : rgbOf(`var(${surface})`, tokens);
      const back = rgbOf(bg, tokens, base);
      const front = rgbOf(d.get("color"), tokens);
      const r = ratio(front, back);
      assert.ok(r >= 4.5, `${selector} on ${surface}: ${r.toFixed(2)}:1`);
    }
  }
  // the formula itself: black on white is 21:1, the grey of the old label was not enough
  assert.ok(Math.abs(ratio([0, 0, 0], [255, 255, 255]) - 21) < 1e-9);
  const old = ratio(
    rgbOf("var(--on-fill)", tokens),
    rgbOf("var(--idle)", tokens),
  );
  assert.ok(old < 4.5, "the former pair (--on-fill on --idle) would fail");
});

// F1 of the review of step 5b: the word in the caption (meta) of the window of
// history is the state of the request - the state of the last row of the main
// session in it (REQ-008 criterion 10, REQ-042 criterion 5).
test("FS-11: the word in the meta of the window of history, opened from a row of the main session, is the literal of the state - 'в работе', 'нет свежих данных', 'сервер перезапускался…', 'закончила работу…', 'окончание не записано'", async () => {
  const ask = lineAt("UserPromptSubmit", "S1", T0 + 500, {
    prompt_kind: "owner",
    prompt_text: "Образец запроса",
  });
  const start = lineAt("SessionStart", "S1", T0);
  const cases = [
    ["in_progress", [start, ask], [], T0 + 2000],
    ["stale", [start, ask], [], T0 + 2 * HOUR],
    ["restarted", [start, ask], [startRec(2, T0 + 1000)], T0 + 2000],
    ["completed", [start, ask, lineAt("Stop", "S1", T0 + 900)], [], T0 + 2000],
    [
      "unrecorded",
      [start, ask, lineAt("SessionEnd", "S1", T0 + 900)],
      [],
      T0 + 2000,
    ],
  ];
  for (const [state, entries, starts, now] of cases) {
    const page = await loaded(entries, starts, { now });
    const row = page
      .items()
      .find((i) => i.dataset.kind === "main" && i.dataset.state === state);
    assert.ok(row !== undefined, `the row of the main session is ${state}`);
    row.byClass("history-open")[0].click();
    const dom = historyDom(page);
    assert.equal(dom.isOpen(), true, state);
    const word = dom.meta().byClass("history-state")[0];
    assert.equal(word.textContent, WORDS[state], `meta: ${state}`);
    assert.equal(word.dataset.state, state);
    dom.close.click();
    assert.equal(dom.isOpen(), false);
  }
  // opened from the button of the row of the journal, too (the same request)
  const page = await loaded([start, ask], [], { now: T0 + 2 * HOUR });
  const opener = page.rows().find((r) => r.classes.has("opens-history"));
  opener.byClass("history-open")[0].click();
  assert.equal(
    historyDom(page).meta().byClass("history-state")[0].textContent,
    "нет свежих данных",
  );
});

// ------------------------------------------------------------------ PN-23
// ISS-0062, REQ-042 criterion 14 (design docs/design/ISS-0062-item-head-wrap.md,
// 4.3 and 7.2). This checks the RULE of the CSS, not the view: the view (no
// squeezed role name, no letters in a column, no sideways scroll) is measured
// in a browser in the acceptance. A browser is not run here: its absence would
// turn into a skip (Q6).

// The layout properties of criterion 14 (and the ones that act the same way).
const LAYOUT_PROPS = new Set([
  "display",
  "position",
  "flex",
  "flex-grow",
  "flex-shrink",
  "flex-basis",
  "flex-wrap",
  "flex-flow",
  "white-space",
  "width",
  "min-width",
  "max-width",
  "overflow-wrap",
  "word-wrap",
  "word-break",
  "text-wrap",
]);

// The last compound of a selector: ".card-section .item-head:hover" gives
// ".item-head:hover" (combinators inside [] and () do not split).
function lastCompound(selector) {
  let depth = 0;
  let token = "";
  let last = "";
  for (const ch of selector.trim()) {
    if (ch === "[" || ch === "(") depth += 1;
    if (ch === "]" || ch === ")") depth -= 1;
    if (depth === 0 && /[\s>+~]/.test(ch)) {
      if (token !== "") last = token;
      token = "";
    } else {
      token += ch;
    }
  }
  return token !== "" ? token : last;
}

const hasClass = (compound, name) =>
  new RegExp(`\\.${name}(?![\\w-])`).test(compound) ||
  new RegExp(`\\[class[~|^$*]?=["']?[^\\]]*${name}`).test(compound);

// Every rule with a selector whose last compound is the class, in any media,
// with any ancestors, attributes or pseudo-classes and pseudo-elements.
function rulesOf(rules, name) {
  return rules
    .map((rule) => ({
      rule,
      tails: rule.selectors.filter((s) => hasClass(lastCompound(s), name)),
    }))
    .filter((x) => x.tails.length > 0);
}

// The problems of the CSS text in the rules of the head of an item and of the
// word of a state; an empty list is a pass.
function itemCssProblems(css) {
  const out = [];
  const rules = parseCss(css);
  const head = cssDecls(rules, ".item-head");
  if (head.get("display") !== "flex") {
    out.push(`.item-head display: ${head.get("display")}`);
  }
  if (head.get("flex-wrap") !== "wrap") {
    out.push(`.item-head flex-wrap: ${head.get("flex-wrap")}`);
  }
  // no other rule that ends in .item-head (a more specific selector, a media
  // block, a pseudo-class) takes the wrap or the flex back
  for (const { rule, tails } of rulesOf(rules, "item-head")) {
    const where = `${rule.media ?? "-"} ${tails.join(", ")}`;
    if (rule.decls.has("flex-wrap") && rule.decls.get("flex-wrap") !== "wrap") {
      out.push(`${where}: flex-wrap ${rule.decls.get("flex-wrap")}`);
    }
    if (rule.decls.has("display") && rule.decls.get("display") !== "flex") {
      out.push(`${where}: display ${rule.decls.get("display")}`);
    }
    if (
      rule.decls.has("flex-flow") &&
      !/(^|\s)wrap(\s|$)/.test(rule.decls.get("flex-flow"))
    ) {
      out.push(`${where}: flex-flow ${rule.decls.get("flex-flow")}`);
    }
  }
  // the word of the state of an item: its own rule has a cap of 100% and may
  // set only that and `flex`; nothing else (any selector, any media) sets a
  // layout property
  const state = cssDecls(rules, ".item-state");
  if (state.get("max-width") !== "100%") {
    out.push(`.item-state max-width: ${state.get("max-width")}`);
  }
  if (/nowrap|pre/.test(state.get("white-space") ?? "")) {
    out.push(`.item-state white-space: ${state.get("white-space")}`);
  }
  const allowedBase = new Set(["flex", "max-width"]);
  for (const { rule, tails } of rulesOf(rules, "item-state")) {
    const base = rule.media === null && tails.every((s) => s === ".item-state");
    for (const name of rule.decls.keys()) {
      if (LAYOUT_PROPS.has(name) && !(base && allowedBase.has(name))) {
        out.push(`${rule.media ?? "-"} ${tails.join(", ")}: ${name}`);
      }
    }
  }
  // the word of the state in the window of history: its own rule sets only
  // `display: inline-block`; nothing else sets a layout property
  const word = cssDecls(rules, ".history-state");
  if (word.get("display") !== "inline-block") {
    out.push(`.history-state display: ${word.get("display")}`);
  }
  for (const { rule, tails } of rulesOf(rules, "history-state")) {
    const base =
      rule.media === null && tails.every((s) => s === ".history-state");
    for (const name of rule.decls.keys()) {
      if (LAYOUT_PROPS.has(name) && !(base && name === "display")) {
        out.push(`${rule.media ?? "-"} ${tails.join(", ")}: ${name}`);
      }
    }
  }
  return out;
}

test("PN-23: the CSS rule of the row (ISS-0062, REQ-042 criterion 14) - the head of an item may wrap, the word of the state may not outgrow the row, the layout properties of the word do not depend on its state or its place; this checks the rule of the CSS, not the view (the view is measured in the acceptance)", () => {
  const css = fs.readFileSync(path.join(PUBLIC, "style.css"), "utf8");
  assert.deepEqual(itemCssProblems(css), []);
  const rules = parseCss(css);
  // the search found what it looks for (an empty search must not pass, Q6)
  const variantSelectors = (name) =>
    rulesOf(rules, name)
      .flatMap((x) => x.tails)
      .filter((s) => /\[data-state=/.test(s)).length;
  assert.ok(
    variantSelectors("item-state") + variantSelectors("history-state") >= 8,
    "at least 8 selectors of the variants [data-state=...]",
  );
  assert.ok(variantSelectors("item-state") >= 4);
  assert.ok(variantSelectors("history-state") >= 4);
  assert.ok(rulesOf(rules, "item-head").length >= 1);
  assert.ok(rulesOf(rules, "item-state").length >= 5);
  assert.ok(rulesOf(rules, "history-state").length >= 5);
  // the pieces of the rule, spelled out
  const head = cssDecls(rules, ".item-head");
  assert.equal(head.get("display"), "flex");
  assert.equal(head.get("flex-wrap"), "wrap");
  assert.equal(cssDecls(rules, ".item-state").get("max-width"), "100%");
  assert.equal(
    cssDecls(rules, ".history-state").get("display"),
    "inline-block",
  );
});

const SAMPLE_CSS = `
.item {
  display: flex;
  flex-direction: column;
  overflow-wrap: anywhere;
}

.item-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.125rem 0.5rem;
}

.item-state {
  flex: none;
  max-width: 100%;
  padding: 0.0625rem 0.4375rem;
  font-weight: 700;
}

.item[data-state="in_progress"] .item-state {
  color: var(--warn);
}

.item[data-state="completed"] .item-state {
  color: var(--ok);
}

.item[data-state="unrecorded"] .item-state {
  color: var(--err);
}

.item[data-state="stale"] .item-state,
.item[data-state="restarted"] .item-state {
  color: var(--text);
}

.history-state {
  display: inline-block;
  padding: 0.0625rem 0.4375rem;
}

.history-state[data-state="in_progress"] {
  color: var(--warn);
}

.history-state[data-state="completed"] {
  color: var(--ok);
}

.history-state[data-state="unrecorded"] {
  color: var(--err);
}

.history-state[data-state="stale"],
.history-state[data-state="restarted"] {
  color: var(--text);
}

@media (max-width: 599px) {
  .top {
    padding: 0.5rem;
  }
}
`;

test("PN-23: the same check on a fixed sample of the rules with a deliberate breakage - the 11 mutants of the design and the ones of the review (a more specific selector, a media block, own layout properties of the word, a pseudo-class or a pseudo-element) are seen; three changes that do not break the criterion are not", () => {
  // a fixed sample of the right rules, not the live file: the checks of the
  // checker must not move when the page changes
  const css = SAMPLE_CSS;
  assert.deepEqual(itemCssProblems(css), []);
  const HEAD = ".item-head {\n  display: flex;\n  flex-wrap: wrap;\n";
  const STATE = ".item-state {\n  flex: none;\n  max-width: 100%;\n";
  const swap = (from, to) => {
    assert.equal(css.split(from).length, 2, `one place for: ${from}`);
    return css.replace(from, to);
  };
  const append = (extra) => `${css}\n${extra}\n`;
  const broken = {
    "M1 no flex-wrap": swap(HEAD, ".item-head {\n  display: flex;\n"),
    "M2 no max-width": swap(STATE, ".item-state {\n  flex: none;\n"),
    "M3 flex-wrap nowrap": swap(HEAD, HEAD.replace("wrap;", "nowrap;")),
    "M4 white-space nowrap on .item-state": swap(
      STATE,
      `${STATE}  white-space: nowrap;\n`,
    ),
    "M5 nowrap in a variant of .item-state": swap(
      '.item[data-state="restarted"] .item-state {\n',
      '.item[data-state="restarted"] .item-state {\n  white-space: nowrap;\n',
    ),
    "M6 min-width on .history-state": swap(
      ".history-state {\n  display: inline-block;\n",
      ".history-state {\n  display: inline-block;\n  min-width: 20rem;\n",
    ),
    "M7 flex none in a variant of .history-state": swap(
      '.history-state[data-state="completed"] {\n',
      '.history-state[data-state="completed"] {\n  flex: none;\n',
    ),
    "M8 media block takes the wrap back": append(
      "@media (max-width: 40rem) {\n  .item-head {\n    flex-wrap: nowrap;\n  }\n}",
    ),
    "M9 max-width 50%": swap(STATE, STATE.replace("100%", "50%")),
    "M10 display block": swap(
      ".item-head {\n  display: flex;",
      ".item-head {\n  display: block;",
    ),
    "M11 wrap-reverse": swap(HEAD, HEAD.replace("wrap;", "wrap-reverse;")),
    "F1a more specific selector (.card-section .item-head)": append(
      ".card-section .item-head {\n  flex-wrap: nowrap;\n}",
    ),
    "F1b more specific selector (#tasks .item .item-head)": append(
      "#tasks .item .item-head {\n  flex-wrap: nowrap;\n}",
    ),
    "F1c flex-flow nowrap on .item-head": append(
      ".item-head {\n  flex-flow: row nowrap;\n}",
    ),
    "F1d own min-width of .item-state": append(
      ".item-state {\n  min-width: 20rem;\n}",
    ),
    "F1e own width of .item-state": append(".item-state {\n  width: 20rem;\n}"),
    "F1f word-break keep-all on .item-state": append(
      ".item-state {\n  word-break: keep-all;\n}",
    ),
    "F1g overflow-wrap normal on .item-state": append(
      ".item-state {\n  overflow-wrap: normal;\n}",
    ),
    "F1h pseudo-class .item-state:hover": append(
      ".item-state:hover {\n  white-space: nowrap;\n}",
    ),
    "F1i pseudo-element .item-state::before": append(
      ".item-state::before {\n  min-width: 20rem;\n}",
    ),
    "F1j .item-state in a media block": append(
      "@media (max-width: 40rem) {\n  .item-state {\n    flex: none;\n    width: 20rem;\n  }\n}",
    ),
    "F1k .history-state with an ancestor": append(
      ".history-meta .history-state {\n  white-space: nowrap;\n}",
    ),
  };
  for (const [name, text] of Object.entries(broken)) {
    assert.notDeepEqual(itemCssProblems(text), [], `${name} must be seen`);
  }
  // these do not break the criterion (the design: M12-M14), and are not seen
  const harmless = {
    "M12 gap 0.5rem": swap("gap: 0.125rem 0.5rem;", "gap: 0.5rem;"),
    "M13 no overflow-wrap anywhere on .item": css.replace(
      /(\.item \{[^}]*?)\n {2}overflow-wrap: anywhere;/,
      "$1",
    ),
    "M14 flex 0 1 auto on .item-state": swap(
      ".item-state {\n  flex: none;",
      ".item-state {\n  flex: 0 1 auto;",
    ),
  };
  assert.notEqual(harmless["M13 no overflow-wrap anywhere on .item"], css);
  for (const [name, text] of Object.entries(harmless)) {
    assert.deepEqual(itemCssProblems(text), [], `${name} is not a breakage`);
  }
});

// ===================================================================
// REQ-036, REQ-045, REQ-044 (design docs/design/REQ-036-044-045-interactive.md,
// table 9). The words of the criteria are literals here, not read from the
// constants under test.
// ===================================================================
import { roleLabel } from "../src/pixel-office/public/office-model.js";
import {
  eventCase,
  eventWords,
  markReason,
  repeatedStarts,
  roleName,
} from "../src/pixel-office/public/words.js";
import { journalRows } from "../src/pixel-office/public/panels.js";
import { buildInstanceCard } from "../src/pixel-office/public/instance-card.js";
import { eventDetails } from "../src/pixel-office/public/event-details.js";
import { agentNames, iso, rng } from "./pixel-office-helpers.js";

// Words that must never appear in a text of the page.
const SERVICE_WORDS = /undefined|null|NaN|\[object/;
const nowRowEls = (page) => page.el("now").all((e) => e.classes.has("now-row"));

// ------------------------------------------------------------------ NM-01

test("NM-01: the names of the roles in plain words - one per code of .claude/agents/*.md, 1-40 characters, no Latin letters and no words of success, all different; a role of Sai is named so in 'Сейчас' and in the panel before and after its end; the canvas shows the same name; any other role is shown as it came", async () => {
  const codes = agentNames().map((n) => {
    const m = /\(([A-Z][A-Z0-9-]*)\)$/.exec(n);
    assert.ok(m, `no code in ${n}`);
    return m[1];
  });
  assert.equal(codes.length, agentNames().length);
  assert.deepEqual(Object.keys(TX.ROLE_NAMES).sort(), [...codes].sort());
  const names = Object.values(TX.ROLE_NAMES);
  assert.equal(new Set(names).size, names.length, "all names differ");
  for (const [code, name] of Object.entries(TX.ROLE_NAMES)) {
    const n = Array.from(name).length;
    assert.ok(n >= 1 && n <= 40, `${code}: ${n} characters`);
    assert.doesNotMatch(name, /[A-Za-z]/, code);
    assert.doesNotMatch(
      name,
      /заверш|готов|выполнен|успешн|завис|остановлен|упал/i,
      code,
    );
    assert.notEqual(name, TX.MAIN_LABEL);
    assert.notEqual(name, TX.ROLE_UNKNOWN);
  }
  // the examples of the requirement, written as literals
  assert.equal(TX.ROLE_NAMES["SECURITY-REVIEWER"], "Проверка безопасности");
  assert.equal(TX.ROLE_NAMES.REVIEWER, "Ревью кода");
  assert.equal(TX.ROLE_NAMES["TEST-RUNNER"], "Запуск проверки");
  assert.equal(TX.ROLE_NAMES["BACKEND-DEV"], "Серверная часть");
  assert.equal(TX.ROLE_NAMES.ORCH, "Оркестратор");
  // every real name of a role of Sai gets the name of its code
  for (const full of agentNames()) {
    const code = /\(([A-Z][A-Z0-9-]*)\)$/.exec(full)[1];
    assert.equal(roleName(full), TX.ROLE_NAMES[code], full);
  }
  // any other role is shown whole, as it came
  const long = "Роль из шестидесяти знаков ".repeat(3).slice(0, 60);
  for (const role of [
    "Explore",
    "general-purpose",
    long,
    "Demo Reviewer (REVIEWER)",
    "Sai Unknown Role (NOT-A-CODE)",
    "Sai Security Reviewer (SECURITY-REVIEWER) copy",
    "(REVIEWER)",
  ]) {
    assert.equal(roleName(role), role);
  }
  assert.equal(roleName(""), TX.ROLE_UNKNOWN);
  assert.equal(roleName(undefined), TX.ROLE_UNKNOWN);
  assert.equal(roleName(42), TX.ROLE_UNKNOWN);
  assert.equal(roleName("__proto__"), "__proto__");
  assert.equal(roleName("Sai X (constructor)"), "Sai X (constructor)");

  // on the page
  const role = "Sai Security Reviewer (SECURITY-REVIEWER)";
  const j = journal();
  j.sessionStart("S1");
  launch(j, "S1", "sr1", role, { description: "проверка входа" });
  launch(j, "S1", "x1", "Demo Reviewer (REVIEWER)");
  const page = await loaded(j.entries);
  const rows = nowRowEls(page).map((r) => r.textContent);
  assert.ok(rows.includes("Проверка безопасности — проверка входа"), rows);
  assert.ok(rows.includes("Demo Reviewer (REVIEWER)"), rows);
  const item = () => page.items().find((i) => i.dataset.key === "sr1");
  assert.equal(item().dataset.state, "in_progress");
  assert.equal(
    item().byClass("item-role")[0].textContent,
    "Проверка безопасности",
  );
  j.subStop("S1", "sr1", role);
  await page.push(j.entries[j.entries.length - 1]);
  assert.equal(item().dataset.state, "completed");
  assert.equal(
    item().byClass("item-role")[0].textContent,
    "Проверка безопасности",
  );
  // the short caption of the canvas is nowhere in the block and the panel
  // (the panel shows the full role beside the name, as before)
  for (const id of ["now", "tasks"]) {
    assert.equal(page.text(id).includes("SECURITY-REVIEW…"), false, id);
    assert.equal(page.text(id).includes("Ревью кода"), false, id);
  }
  assert.equal(page.text("now").includes("SECURITY-REVIEWER"), false);
  // REQ-048: the canvas shows the same name; the short caption is gone
  page.ctx.clear();
  page.frames.step();
  const drawn = page.ctx
    .lastFrame()
    .filter((c) => c.op === "fillText")
    .map((c) => c.args[0]);
  assert.ok(drawn.includes("Проверка безопасности"), drawn.join(" | "));
  assert.equal(roleLabel(role), "SECURITY-REVIEW…", "the rule itself is kept");
  assert.equal(drawn.includes(roleLabel(role)), false);
});

// ------------------------------------------------------------------ NM-02

test("NM-02: one row of 'Сейчас' per item in progress, in the order of 'Текущие' - 1, 5 (three roles, two of them twice, with their own descriptions), the main session and two; a row goes after SubagentStop; nothing in progress - 'в работе ничего нет'; no 'и ещё' anywhere in the code", async () => {
  const j = journal();
  j.sessionStart("S1");
  launch(j, "S1", "p1", "Plan", { description: "план один" });
  let page = await loaded(j.entries);
  assert.deepEqual(
    nowRowEls(page).map((r) => r.textContent),
    ["Plan — план один"],
  );
  launch(j, "S1", "p2", "Plan", { description: "план два" });
  launch(j, "S1", "e1", "Explore", { description: "поиск" });
  launch(j, "S1", "e2", "Explore");
  launch(j, "S1", "o1", "Sai Orchestrator (ORCH)", { description: "маршрут" });
  page = await loaded(j.entries);
  const keys = () => nowRowEls(page).map((r) => r.dataset.key);
  const current = () =>
    page
      .items()
      .filter((i) => i.dataset.state === "in_progress")
      .map((i) => i.dataset.key);
  assert.deepEqual(
    nowRowEls(page).map((r) => r.textContent),
    [
      "Оркестратор — маршрут",
      "Explore",
      "Explore — поиск",
      "Plan — план два",
      "Plan — план один",
    ],
  );
  assert.deepEqual(keys(), current(), "the order of 'Текущие'");
  // a row with no description: the name only, no separator
  const e2 = nowRowEls(page).find((r) => r.dataset.key === "e2");
  assert.equal(e2.byClass("now-sep").length, 0);
  assert.equal(e2.byClass("now-desc").length, 0);
  // the main session and two agents: three rows, by the order of the panel
  const m = journal();
  m.sessionStart("S1");
  launch(m, "S1", "a", "Plan");
  m.prompt("S1");
  launch(m, "S1", "b", "Explore");
  const mp = await loaded(m.entries);
  const model = mp.app.getModel();
  const want = taskPanel(model).current.map((i) => i.key);
  assert.deepEqual(
    nowLine(model).rows.map((r) => r.key),
    want,
  );
  assert.deepEqual(
    nowRowEls(mp).map((r) => r.dataset.key),
    want,
  );
  assert.equal(nowRowEls(mp).length, 3);
  assert.equal(nowRowEls(mp)[1].dataset.kind, "main");
  assert.equal(nowRowEls(mp)[1].textContent, MAIN_ROW);
  // an end takes the row away at the next poll
  m.subStop("S1", "b", "Explore");
  await mp.push(m.entries[m.entries.length - 1]);
  assert.deepEqual(
    nowRowEls(mp).map((r) => r.dataset.key),
    want.filter((k) => k !== "b"),
  );
  // nothing in progress
  m.subStop("S1", "a", "Plan");
  m.stop("S1");
  await mp.push(...m.entries.slice(-2));
  assert.equal(nowRowEls(mp).length, 0);
  assert.equal(mp.text("now-text"), "Сейчас: в работе ничего нет");
  // no tail "and N more" and no constant for it in the code of Pixel Office;
  // the name and the words are put together here, so this file does not hold
  // them itself (criterion 9 (c) of REQ-036 greps tools/test/ too)
  const oldName = ["NOW", "MORE"].join("_");
  const oldTail = new RegExp(`${oldName}|· и ${"ещё"}`);
  const hits = [];
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir)) {
      const file = path.join(dir, name);
      if (fs.statSync(file).isDirectory()) walk(file);
      else if (oldTail.test(fs.readFileSync(file, "utf8"))) {
        hits.push(file);
      }
    }
  };
  walk(path.join(PUBLIC, ".."));
  assert.deepEqual(hits, []);
  assert.equal(Object.hasOwn(TX, oldName), false);
  // the expression itself sees both
  assert.equal(oldTail.test(`Сейчас: Plan · и ${"ещё"} 2 в работе`), true);
  assert.equal(oldTail.test(`import { ${oldName} }`), true);
});

// ------------------------------------------------------------------ NM-03

const NOW_SELECTORS = [
  "now",
  "now-label",
  "now-text",
  "now-list",
  "now-row",
  "now-role",
  "now-sep",
  "now-desc",
];

test("NM-03: nothing of a row of 'Сейчас' is cut - a description of 100 wide characters, a role of 60, a word without spaces are whole, with no '…'; no rule of the eight classes of the block sets text-overflow, -webkit-line-clamp or white-space: nowrap, in any media", async () => {
  const wide = "Ｗ".repeat(100);
  const role = "Роль-без-пробелов-".repeat(4).slice(0, 60);
  const j = journal();
  j.sessionStart("S1");
  launch(j, "S1", "w1", role, { description: wide });
  launch(j, "S1", "w2", "Plan", { description: "слово".repeat(20) });
  const page = await loaded(j.entries);
  const texts = nowRowEls(page).map((r) => r.textContent);
  assert.ok(texts.includes(`${role} — ${wide}`), texts.join(" | "));
  assert.ok(texts.includes(`Plan — ${"слово".repeat(20)}`));
  assert.equal(page.text("now").includes("…"), false);
  // the rules of the stylesheet
  const rules = parseCss(
    fs.readFileSync(path.join(PUBLIC, "style.css"), "utf8"),
  );
  let seen = 0;
  for (const rule of rules) {
    const mine = rule.selectors.filter((s) =>
      NOW_SELECTORS.some((name) => hasClass(lastCompound(s), name)),
    );
    if (mine.length === 0) continue;
    seen += 1;
    const where = `${rule.media ?? "-"} ${mine.join(", ")}`;
    assert.equal(rule.decls.has("text-overflow"), false, where);
    assert.equal(rule.decls.has("-webkit-line-clamp"), false, where);
    assert.doesNotMatch(rule.decls.get("white-space") ?? "", /nowrap/, where);
  }
  assert.ok(seen >= 8, `rules of the block found: ${seen}`);
  // the narrow media block holds rules of the block too (it was cut there)
  assert.ok(
    rules.some(
      (r) =>
        r.media === "@media (max-width: 599px)" &&
        r.selectors.some((s) => /\.now/.test(s)),
    ),
  );
});

// ------------------------------------------------------------------ NM-04

test("NM-04: twelve agents give twelve rows and no 'и ещё'; the list of 'Сейчас' scrolls inside (overflow-y: auto)", async () => {
  const j = journal();
  j.sessionStart("S1");
  for (let i = 0; i < 12; i++) {
    launch(j, "S1", `r${i}`, `Роль ${i}`, { description: `дело ${i}` });
  }
  const page = await loaded(j.entries);
  assert.equal(nowRowEls(page).length, 12);
  assert.equal(page.text("now").includes("и ещё"), false);
  const list = page.el("now-list");
  assert.ok(list !== null);
  assert.equal(list.getAttribute("role"), "list");
  assert.equal(list.getAttribute("tabindex"), "0");
  assert.equal(list.getAttribute("aria-label"), "Сейчас — работающие агенты");
  for (const row of nowRowEls(page)) {
    assert.equal(row.getAttribute("role"), "listitem");
  }
  const rules = parseCss(
    fs.readFileSync(path.join(PUBLIC, "style.css"), "utf8"),
  );
  assert.equal(cssDecls(rules, ".now-list").get("overflow-y"), "auto");
  // the list keeps its scroll between rebuilds
  list.scrollTop = 33;
  j.subStart("S1", "late", "Plan");
  await page.push(j.entries[j.entries.length - 1]);
  assert.equal(page.el("now-list").scrollTop, 33);
  assert.equal(nowRowEls(page).length, 13);
});

// ------------------------------------------------------------------ NM-05

test("NM-05: the rows of 'Сейчас' come only from agent_type and description - a request of the owner and a record of the orchestrator with req_id and note_text are not in the block; the page sends only GET; the link lost - the block stays", async () => {
  const j = journal();
  j.sessionStart("S1");
  j.ownerPrompt("S1", "ТЕКСТ-ЗАПРОСА-NM05");
  j.note({
    session_id: "S1",
    req_id: "REQ-044",
    note_text: "ТЕКСТ-ЗАПИСИ-NM05",
  });
  launch(j, "S1", "a1", "Plan", { description: "дело" });
  const page = await loaded(j.entries);
  const shown = page.text("now") + page.el("now").title;
  for (const word of ["ТЕКСТ-ЗАПРОСА-NM05", "ТЕКСТ-ЗАПИСИ-NM05", "REQ-044"]) {
    assert.equal(shown.includes(word), false, word);
  }
  // the record is in the journal (so the test is not empty)
  assert.ok(page.text("journal").includes("Оркестратор записал"));
  assert.deepEqual(
    nowRowEls(page).map((r) => r.textContent),
    ["Plan — дело", MAIN_ROW],
  );
  for (const row of nowLine(page.app.getModel()).rows) {
    assert.deepEqual(Object.keys(row).sort(), [
      "description",
      "key",
      "kind",
      "role",
      "text",
    ]);
  }
  // only GET in the code and on the wire
  const methods = [];
  for (const name of fs.readdirSync(PUBLIC)) {
    const text = fs.readFileSync(path.join(PUBLIC, name), "utf8");
    if (/method *: *['"](POST|PUT|PATCH|DELETE)/.test(text)) methods.push(name);
  }
  assert.deepEqual(methods, []);
  for (const c of page.server.calls) assert.equal(c.init.method, "GET");
  // the link is lost: the rows stay
  const kept = page.text("now");
  page.server.mode = "fail";
  await page.tick(2000);
  assert.equal(page.el("link").dataset.state, "down");
  assert.equal(page.text("now"), kept);
});

// ------------------------------------------------------------------ JR-01

// The table of the 12 cases of the journal, written here as literals of the
// description of the interface (REQ-045 criterion 1); EVENT_TABLE must equal it.
// REQ-045 in its new wording (REQ-048, rows 8-15): every value below is
// written verbatim in the block REQ-045 of docs/requirements.yaml.
const EVENT_TABLE_LITERAL = {
  session_start: {
    words: "Открыт разговор с Claude Code",
    meaning:
      "В Claude Code начат новый разговор (сессия) или продолжен прежний: при продолжении номер сессии тот же. Что именно произошло, Claude Code сейчас не сообщает.",
    not_proved: "Не доказывает, что началась работа или пришёл запрос.",
  },
  session_end: {
    words: "Закрыт разговор с Claude Code",
    meaning:
      "Разговор (сессия) закончился: окно закрыли, разговор очистили или переключили. Причину Claude Code сейчас не сообщает.",
    not_proved:
      "Не доказывает, что работа доведена до конца: агенты этой сессии могли не закончить.",
  },
  prompt_owner: {
    words: "Владелец отправил запрос",
    meaning:
      "Человек отправил сообщение в основную сессию; с него начинается строка «Основная сессия — обрабатывает запрос». Текст — в окне «Просмотр истории», если хранение текста включено.",
    not_proved: "Не доказывает, что запрос понят или сделан.",
  },
  prompt_service: {
    words: "В сессию пришло служебное сообщение",
    meaning:
      "Сообщение от системы, а не от человека: напоминание, уведомление о задаче, которая шла параллельно, сообщение из другого разговора с Claude Code или пометка о продолжении прежнего разговора. Его текст не хранится.",
    not_proved: "Не доказывает, что его написал человек.",
  },
  prompt_unknown: {
    words: "В сессию пришло сообщение",
    meaning:
      "Сообщение в основную сессию. Кто его написал — человек или система, — в этой строке не записано.",
    not_proved: "Не доказывает, что его написал человек.",
  },
  stop: {
    words: "Основная сессия вернула ответ",
    meaning:
      "Основная сессия закончила очередной ответ и ждёт следующего сообщения.",
    not_proved:
      "Не доказывает, что вся работа закончена или удалась: агенты, запущенные параллельно, могут ещё работать, и сессия может продолжить сама, когда они вернутся. При прерывании человеком и при ошибке этого события нет.",
  },
  agent_start: {
    words: "Агент «{role}» получил задание и начал работу",
    act: "получил задание и начал работу",
    meaning:
      "Claude Code запустил агента этой роли; его номер — в технических полях.",
    not_proved:
      "Не доказывает, какое задание и кто его дал: это видно только по связанной записи «Задание передано агенту».",
  },
  agent_resume: {
    words: "Агент «{role}» продолжил работу",
    act: "продолжил работу",
    meaning:
      "Тот же агент, с тем же номером, снова начал работу над той же задачей.",
    not_proved:
      "Не доказывает, что прежняя работа удалась или что задание новое.",
  },
  agent_stop: {
    words: "Агент «{role}» закончил работу и вернул ответ",
    act: "закончил работу и вернул ответ",
    meaning:
      "Агент закончил свой ход и вернул ответ тому, кто его запустил. Текст ответа Pixel Office не хранит: итог не записан. Такое событие присылают и служебные помощники самого Claude Code — их начала в журнале нет, а роль совпадает с ролью разговора или пуста.",
    not_proved:
      "Не доказывает, что задание сделано, что проверки прошли и что ответ верен. Агента могут продолжить.",
  },
  handoff: {
    words: "Задание передано агенту «{role}»",
    meaning:
      "Тот, кто передал задание (основная сессия или другой агент), запустил агента, и Claude Code вернул номер запущенного агента. Описание — то, что написал передавший (до 100 знаков). Если агент работает параллельно с тем, кто его запустил, эта запись приходит сразу при запуске; если запустивший ждёт его ответа — после окончания работы агента.",
    not_proved:
      "Не доказывает, что агент закончил работу или что задание сделано. Время записи — не время начала работы агента.",
  },
  orch_note: {
    words: "Оркестратор записал, как понял запрос",
    meaning:
      "Запись, которую оркестратор сделал сам; это не событие от Claude Code. К запросу она привязана по времени запроса, если оно записано.",
    not_proved:
      "Не доказывает, что работа идёт или сделана так, как записано: это слова оркестратора.",
  },
  marked: {
    meaning:
      "Строка есть в журнале, но Pixel Office не признал её настоящим событием от Claude Code.",
    not_proved:
      "Не доказывает, что событие было; на задачи, офис и состояния строка не влияет.",
    reasons: {
      source: "строку записал не Claude Code",
      conflict:
        "время строки расходится с порядком строк в журнале больше чем на 2 минуты",
      future:
        "время последней строки позже часов этого компьютера больше чем на минуту",
    },
  },
};

const plain = (v) => JSON.parse(JSON.stringify(v));
// The two obsolete exports of texts.js (removed at step 5c): no test and no
// module of the page imports them.
const OLD_LABELS = ["EVENT", "LABELS"].join("_");
const OLD_WORKING = ["CARD", "WORKING"].join("_");
const SEVEN_OLD_WORDS = [
  "сессия началась",
  "сессия закончилась",
  "запрос отправлен",
  "ответ закончен",
  "субагент запущен",
  "субагент закончил",
  "вызов субагента",
];

// A journal with every kind of line: the three kinds of a request, a repeated
// start, a record of the orchestrator and the three marks (design 9.2, JR-01).
function allKindsJournal() {
  const s = (n) => T0 + n * 1000;
  const orch = "Sai Orchestrator (ORCH)";
  const entries = [
    lineAt("SessionStart", "S1", s(1)),
    lineAt("UserPromptSubmit", "S1", s(2), {
      prompt_kind: "owner",
      prompt_text: "Образец запроса",
    }),
    lineAt("UserPromptSubmit", "S1", s(3), { prompt_kind: "service" }),
    lineAt("UserPromptSubmit", "S1", s(4)),
    lineAt("PostToolUse", "S1", s(5), {
      tool_use_id: "tu1",
      launched_agent_id: "a1",
      subagent_type: orch,
      description: "маршрут",
    }),
    lineAt("SubagentStart", "S1", s(6), { agent_id: "a1", agent_type: orch }),
    lineAt("SubagentStop", "S1", s(7), { agent_id: "a1", agent_type: orch }),
    lineAt("SubagentStart", "S1", s(8), { agent_id: "a1", agent_type: orch }),
    {
      time: iso(s(9)),
      source: "ORCH",
      session_id: "S1",
      note_text: "как понял: образец",
      req_id: "REQ-045",
    },
    lineAt("Stop", "S1", s(10)),
    { ...lineAt("SessionStart", "S2", s(11)), source: "SIMULATION" },
    // earlier than the lines before it by much more than 2 minutes: conflict
    lineAt("SubagentStart", "S1", s(12) - 400_000, {
      agent_id: "a2",
      agent_type: "Plan",
    }),
    lineAt("SessionEnd", "S1", s(13)),
    // the last line, ten minutes after the clock of the page: future
    lineAt("Stop", "S9", NOW + 600_000),
  ];
  const words = [
    "Открыт разговор с Claude Code",
    "Владелец отправил запрос",
    "В сессию пришло служебное сообщение",
    "В сессию пришло сообщение",
    "Задание передано агенту «Оркестратор»",
    "Агент «Оркестратор» получил задание и начал работу",
    "Агент «Оркестратор» закончил работу и вернул ответ",
    "Агент «Оркестратор» продолжил работу",
    "Оркестратор записал, как понял запрос",
    "Основная сессия вернула ответ",
    "Открыт разговор с Claude Code",
    "Агент «Plan» получил задание и начал работу",
    "Закрыт разговор с Claude Code",
    "Основная сессия вернула ответ",
  ];
  return { entries, words };
}

test("JR-01: one table of 12 cases - EVENT_TABLE equals the literals of the criterion, the short words of the card are the end of the words of the cases 7-9; on a journal with every kind the words of each row are its case with its own role, the same in the timeline of the window; the old seven words are gone from the page", async () => {
  assert.deepEqual(plain(TX.EVENT_TABLE), EVENT_TABLE_LITERAL);
  assert.equal(Object.keys(TX.EVENT_TABLE).length, 12);
  for (const key of ["agent_start", "agent_resume", "agent_stop"]) {
    const row = TX.EVENT_TABLE[key];
    assert.equal(row.words, `Агент «{role}» ${row.act}`, key);
  }
  for (const [key, row] of Object.entries(TX.EVENT_TABLE)) {
    assert.ok(row.not_proved.startsWith("Не доказывает"), key);
    assert.doesNotMatch(
      JSON.stringify(row),
      /заверш|готов|выполнен|успешн/i,
      key,
    );
  }
  const { entries, words } = allKindsJournal();
  const page = await loaded(entries);
  const shown = page.rows().map((r) => r.byClass("event")[0].textContent);
  assert.deepEqual(shown, words);
  const marks = page.rows().map((r) => r.dataset.marked);
  assert.deepEqual(
    marks.map((m, i) => (m === "true" ? i : null)).filter((i) => i !== null),
    [10, 11, 13],
  );
  const reasons = journalRows(page.app.getModel(), page.app.getOffice()).map(
    (r) => r.reason,
  );
  assert.equal(reasons[10], "source");
  assert.equal(reasons[11], "conflict");
  assert.equal(reasons[13], "future");
  // the timeline of the window: the same words, the record by its own caption
  const h = buildHistory(page.app.getModel());
  assert.equal(h.requests.length, 1);
  let checked = 0;
  for (const item of h.requests[0].timeline) {
    if (item.kind === "note") {
      assert.equal(item.what, TX.HISTORY_NOTE_BY);
    } else {
      assert.equal(item.what, words[item.index], `line ${item.index}`);
    }
    checked += 1;
  }
  assert.ok(checked >= 8);
  // the old words: not on the page; in the code only in the obsolete export of
  // texts.js, which nothing of the page or of the tests imports (it is removed
  // at step 5c, after which the criterion's grep over public/ is empty)
  for (const old of SEVEN_OLD_WORDS) {
    assert.equal(page.text("journal").includes(old), false, old);
  }
  for (const name of fs.readdirSync(PUBLIC)) {
    const text = fs.readFileSync(path.join(PUBLIC, name), "utf8");
    if (name === "texts.js") {
      const block = new RegExp(
        `export const ${OLD_LABELS} = Object\\.freeze\\(\\{[^}]*\\}\\);`,
      );
      const rest = text.replace(block, "");
      for (const old of SEVEN_OLD_WORDS) {
        assert.equal(rest.includes(old), false, `${name}: ${old}`);
      }
      continue;
    }
    for (const old of SEVEN_OLD_WORDS) {
      assert.equal(text.includes(old), false, `${name}: ${old}`);
    }
    assert.equal(
      text.includes(OLD_LABELS),
      false,
      `${name} uses the old table`,
    );
  }
  for (const name of fs.readdirSync(
    path.join(PUBLIC, "..", "..", "..", "test"),
  )) {
    if (!name.startsWith("pixel-office-")) continue;
    const text = fs.readFileSync(
      path.join(PUBLIC, "..", "..", "..", "test", name),
      "utf8",
    );
    // the names are put together here, so this file does not name them
    assert.equal(text.includes(OLD_LABELS), false, name);
    assert.equal(text.includes(OLD_WORKING), false, name);
  }
});

// ------------------------------------------------------------------ JR-02

// The fields of a row that never change once the row is there.
const fixed = (r) => ({
  index: r.index,
  time: r.time,
  who: r.who,
  words: r.words,
  session_id: r.session_id,
  source: r.source,
  agent_id: r.agent_id,
});

function rowsOf(entries, now) {
  const m = buildModel(entries, [], now);
  return journalRows(m, buildOffice(m)).map((r) => ({
    ...r,
    agent_id: m.entries[r.index]?.agent_id,
  }));
}

test("JR-02: the words of a row do not depend on later lines or on the clock - for every beginning of the journal of both orders (handoff first, handoff last) and for the clock before and after STALE_AFTER_MS the time, who, words, session, agent and source equal the full ones; the description comes later; a mark 'future' gives the texts of case 12 and goes with the next line; no word of a state in a row; a forged line does not make a real start a resume", async () => {
  const orch = "Sai Orchestrator (ORCH)";
  const s = (n) => T0 + n * 1000;
  const post = (n) =>
    lineAt("PostToolUse", "S1", s(n), {
      tool_use_id: "tu1",
      launched_agent_id: "a1",
      subagent_type: orch,
      description: "маршрут",
    });
  const start = (n) =>
    lineAt("SubagentStart", "S1", s(n), { agent_id: "a1", agent_type: orch });
  const stop = (n) =>
    lineAt("SubagentStop", "S1", s(n), { agent_id: "a1", agent_type: orch });
  const orders = {
    background: [
      lineAt("SessionStart", "S1", s(1)),
      post(2),
      start(3),
      stop(4),
    ],
    foreground: [
      lineAt("SessionStart", "S1", s(1)),
      start(2),
      stop(3),
      post(4),
    ],
  };
  for (const [name, all] of Object.entries(orders)) {
    for (const now of [s(10), s(10) + STALE_AFTER_MS + 1]) {
      const full = rowsOf(all, now).map(fixed);
      for (let n = 1; n <= all.length; n++) {
        const part = rowsOf(all.slice(0, n), now).map(fixed);
        assert.deepEqual(part, full.slice(0, n), `${name}, ${n} lines`);
      }
      for (const r of rowsOf(all, now)) {
        for (const word of Object.values(TX.STATE_LABELS)) {
          assert.equal(r.words.includes(word), false, `${name}: ${word}`);
        }
      }
    }
  }
  // the words of a handoff are the same before and after its start arrives
  const bg = orders.background;
  assert.equal(
    rowsOf(bg.slice(0, 2), s(10))[1].words,
    rowsOf(bg, s(10))[1].words,
  );
  assert.equal(
    rowsOf(bg, s(10))[1].words,
    "Задание передано агенту «Оркестратор»",
  );
  // the role of a handoff is the one of its own line, not of the task it
  // started (here the line says Plan, the started agent says Explore)
  const other = [
    lineAt("SessionStart", "S1", s(1)),
    lineAt("PostToolUse", "S1", s(2), {
      tool_use_id: "tu9",
      launched_agent_id: "x9",
      subagent_type: "Plan",
    }),
  ];
  const otherFull = [
    ...other,
    lineAt("SubagentStart", "S1", s(3), {
      agent_id: "x9",
      agent_type: "Explore",
    }),
  ];
  assert.equal(rowsOf(other, s(10))[1].words, "Задание передано агенту «Plan»");
  assert.equal(
    rowsOf(otherFull, s(10))[1].words,
    "Задание передано агенту «Plan»",
  );
  // in the foreground order the description of the start comes only with the
  // handoff (rule z): it changes later, the words do not
  const fg = orders.foreground;
  assert.equal(rowsOf(fg.slice(0, 3), s(10))[1].description, "");
  assert.equal(rowsOf(fg, s(10))[1].description, "маршрут");
  // the last line from the future: case 12 in the details, with the reason;
  // after the next line it is a line of its own case, the words stay
  const late = [
    lineAt("SessionStart", "S1", s(1)),
    lineAt("Stop", "S1", s(10) + 600_000),
  ];
  const one = buildModel(late, [], s(10));
  assert.equal(one.marks[1], "future");
  const d1 = eventDetails(one, buildHistory(one), 1);
  assert.equal(d1.meaning, EVENT_TABLE_LITERAL.marked.meaning);
  assert.equal(
    d1.mark,
    "не подтверждена: время последней строки позже часов этого компьютера больше чем на минуту",
  );
  const later = [...late, lineAt("Stop", "S1", s(10) + 601_000)];
  const two = buildModel(later, [], s(10) + 700_000);
  assert.equal(two.marks[1], null);
  const d2 = eventDetails(two, buildHistory(two), 1);
  assert.equal(d2.meaning, EVENT_TABLE_LITERAL.stop.meaning);
  assert.equal(d2.mark, null);
  assert.equal(d1.words, d2.words);
  // a forged line of another source before the real first start does not make
  // the real start a resume (decision 0055, item 2)
  const forged = [
    lineAt("SessionStart", "S1", s(1)),
    { ...start(2), source: "SIMULATION" },
    start(3),
    start(4),
  ];
  assert.deepEqual(
    rowsOf(forged, s(10)).map((r) => r.words),
    [
      "Открыт разговор с Claude Code",
      "Агент «Оркестратор» получил задание и начал работу",
      "Агент «Оркестратор» получил задание и начал работу",
      "Агент «Оркестратор» продолжил работу",
    ],
  );
  // the case shared with the card (F2): the first REAL start is marked by a
  // conflict of time; the next trusted start of the same agent is a resume -
  // in the journal and in the card alike
  const shared = [
    lineAt("SessionStart", "S1", s(300)),
    lineAt("SubagentStart", "S1", s(1), { agent_id: "a1", agent_type: orch }),
    lineAt("SubagentStart", "S1", s(301), { agent_id: "a1", agent_type: orch }),
  ];
  const page = await loaded(shared, [], { now: s(302) });
  const m = page.app.getModel();
  assert.equal(m.marks[1], "conflict");
  assert.equal(m.marks[2], null);
  assert.equal(
    page.rows()[2].byClass("event")[0].textContent,
    "Агент «Оркестратор» продолжил работу",
  );
  const card = buildInstanceCard(m, page.app.getOffice(), "a1");
  assert.deepEqual(
    card.starts.map((x) => x.kind),
    ["resume"],
  );
  assert.equal(card.agent_event.kind, "resume");
  assert.equal(card.task_state.last_start.kind, "resume");
  page
    .legend()
    .find((b) => b.dataset.key === `role:${orch}`)
    .click();
  const box = page.el("card");
  const starts = box.find((e) => e.dataset.part === "starts");
  assert.ok(
    starts
      .byClass("entry-line")[0]
      .textContent.startsWith("продолжил работу · "),
  );
  const row = (name) => box.find((e) => e.dataset.row === name);
  assert.ok(
    row("agent")
      .byClass("state-value")[0]
      .textContent.startsWith("продолжил работу · "),
  );
  assert.ok(
    row("task")
      .byClass("state-basis")[1]
      .textContent.startsWith("продолжил работу · "),
  );
  assert.equal(box.textContent.includes("получил задание"), false);
});

// ------------------------------------------------------------------ JR-04

test("JR-04: records of the orchestrator are rows of the journal at their place - 'Оркестратор записал, как понял запрос', who 'Оркестратор', 'сессия не указана' when there is none; their text and requirement are only in the details; 'Работа' and 'Офис' are as without them; the counter of 'Всё' counts them; the model, the office and 'Сейчас' are as without them", async () => {
  const j = journal();
  j.sessionStart("S1");
  j.ownerPrompt("S1", "Образец запроса");
  launch(j, "S1", "a1", "Plan", { description: "дело" });
  const base = [...j.entries];
  const withNotes = [
    ...base.slice(0, 2),
    {
      time: at(2),
      source: "ORCH",
      session_id: "S1",
      req_id: "REQ-045",
      request_time: base[1].time,
      note_text: "понял так: ключ [скрыто] и дальше",
    },
    ...base.slice(2),
    {
      time: at(9),
      source: "ORCH",
      req_id: "REQ-046",
      note_text: "вторая запись без сессии",
    },
  ];
  const page = await loaded(withNotes);
  const plainPage = await loaded(base);
  const rows = page.rows();
  assert.equal(rows.length, base.length + 2);
  const notes = rows.filter((r) => r.dataset.kind === "note");
  assert.deepEqual(
    notes.map((r) => r.dataset.index),
    ["2", String(withNotes.length - 1)],
  );
  for (const r of notes) {
    assert.equal(
      r.byClass("event")[0].textContent,
      "Оркестратор записал, как понял запрос",
    );
    assert.equal(r.byClass("who")[0].textContent, "Оркестратор");
    assert.equal(r.dataset.tone, "note");
    for (const hidden of ["понял так", "вторая запись", "REQ-045", "REQ-046"]) {
      assert.equal(r.textContent.includes(hidden), false, hidden);
    }
  }
  assert.equal(notes[0].byClass("session")[0].textContent, "S1");
  assert.equal(notes[1].byClass("session")[0].textContent, "сессия не указана");
  // the details carry the text, with every "[скрыто]" in its own element
  notes[0].byClass("row-toggle")[0].click();
  const open = page.rows().find((r) => r.dataset.index === "2");
  const details = open.byClass("event-details")[0];
  const field = (name) => details.find((e) => e.dataset.field === name);
  assert.equal(
    field("note_text").byClass("detail-value")[0].textContent,
    "понял так: ключ [скрыто] и дальше",
  );
  assert.equal(
    field("note_text")
      .byClass("history-masked")
      .map((e) => e.textContent)
      .join(""),
    "[скрыто]",
  );
  assert.equal(field("req").byClass("detail-value")[0].textContent, "REQ-045");
  assert.ok(field("request_time") !== null);
  // the filters: "Работа" and "Офис" are as without the records
  const filtered = async (p, name) => {
    p.el(`filter-${name}`).click();
    await settle();
    return p.rows().map((r) => r.dataset.index);
  };
  const shift = (list) =>
    list.map((i) => String(Number(i) + (Number(i) >= 2 ? 1 : 0)));
  assert.deepEqual(
    await filtered(page, "work"),
    shift(await filtered(plainPage, "work")),
  );
  assert.deepEqual(
    await filtered(page, "office"),
    shift(await filtered(plainPage, "office")),
  );
  await filtered(page, "all");
  assert.ok(
    page
      .text("journal-meta")
      .endsWith(` · ${withNotes.length} из ${withNotes.length}`),
  );
  // the model, the office and "Сейчас" are as without the records
  const strip = (m) =>
    JSON.stringify({
      tasks: m.tasks.map((t) => [t.key, t.state, t.description]),
      rows: m.mainRows.map((r) => [r.state, r.session_id]),
      sessions: m.sessions.map((x) => [x.session_id, x.word]),
    });
  assert.equal(strip(page.app.getModel()), strip(plainPage.app.getModel()));
  assert.deepEqual(
    page.app.getOffice().characters.map((c) => [c.key, c.working]),
    plainPage.app.getOffice().characters.map((c) => [c.key, c.working]),
  );
  assert.equal(page.text("now"), plainPage.text("now"));
});

// ------------------------------------------------------------------ JR-08

test("JR-08: the role and the source go into the templates whole - '$&' and \"$'\" stay literal; the repeated starts equal the direct definition on 300 random journals (the marks and other sources are not read)", () => {
  for (const role of ["$&", "$'", "$`", "$$", "a$1b"]) {
    const e = {
      hook_event_name: "SubagentStart",
      agent_id: "x",
      agent_type: role,
      session_id: "S",
      source: "REAL",
      time: at(1),
    };
    assert.equal(
      eventWords(eventCase(e, false), e),
      `Агент «${role}» получил задание и начал работу`,
    );
    const p = {
      hook_event_name: "PostToolUse",
      subagent_type: role,
      session_id: "S",
      source: "REAL",
      time: at(1),
    };
    assert.equal(eventWords("handoff", p), `Задание передано агенту «${role}»`);
    // REQ-048, row 15: the reason names no source value at all
    assert.equal(
      markReason("source", { source: role }),
      "строку записал не Claude Code",
    );
  }
  // the direct definition: a start is repeated if an earlier line of the file
  // is a start of the same agent_id with the source REAL
  const direct = (entries) => {
    const out = new Set();
    entries.forEach((e, i) => {
      if (e === null || e.hook_event_name !== "SubagentStart") return;
      if (typeof e.agent_id !== "string") return;
      for (let k = 0; k < i; k++) {
        const p = entries[k];
        if (
          p !== null &&
          p.hook_event_name === "SubagentStart" &&
          p.agent_id === e.agent_id &&
          p.source === "REAL"
        ) {
          out.add(i);
          break;
        }
      }
    });
    return out;
  };
  const rand = rng(4545);
  const pick = (list) => list[Math.floor(rand() * list.length)];
  for (let round = 0; round < 300; round++) {
    const entries = [];
    const size = 1 + Math.floor(rand() * 12);
    for (let i = 0; i < size; i++) {
      if (rand() < 0.08) {
        entries.push(null);
        continue;
      }
      const e = {
        time: at(Math.floor(rand() * 600) - 300),
        source: pick(["REAL", "REAL", "REAL", "SIMULATION", "ORCH"]),
        hook_event_name: pick([
          "SubagentStart",
          "SubagentStart",
          "SubagentStop",
          "PostToolUse",
        ]),
        session_id: pick(["S1", "S2"]),
      };
      if (rand() < 0.9) e.agent_id = pick(["a1", "a2", "a3"]);
      entries.push(e);
    }
    assert.deepEqual(
      [...repeatedStarts(entries)].sort((a, b) => a - b),
      [...direct(entries)].sort((a, b) => a - b),
      `round ${round}`,
    );
    // the marks of the reading rule do not change it
    const m = buildModel(entries, [], T0);
    assert.deepEqual(repeatedStarts(m.entries), repeatedStarts(entries));
  }
});

// ------------------------------------------------------------------ JR-09

test("JR-09: the rule of the CSS of a row of the journal (the view is checked in the acceptance) - the focus ring of the toggle is drawn inside, the toggle and the words of the event never forbid a wrap, in any media", () => {
  const rules = parseCss(
    fs.readFileSync(path.join(PUBLIC, "style.css"), "utf8"),
  );
  assert.equal(
    cssDecls(rules, ".row-toggle:focus-visible").get("outline-offset"),
    "-0.125rem",
  );
  let seen = 0;
  for (const rule of rules) {
    const mine = rule.selectors.filter(
      (sel) =>
        hasClass(lastCompound(sel), "row-toggle") ||
        hasClass(lastCompound(sel), "event"),
    );
    if (mine.length === 0) continue;
    seen += 1;
    assert.doesNotMatch(
      rule.decls.get("white-space") ?? "",
      /nowrap|pre/,
      `${rule.media ?? "-"} ${mine.join(", ")}`,
    );
    assert.equal(rule.decls.has("text-overflow"), false);
  }
  assert.ok(seen >= 2);
});

// ------------------------------------------------------------------ AC-05

const MIN5 = 5 * 60 * 1000;
// The three lines of "Состояние" of the open card: value and basis lines.
function stateRows(page) {
  const out = {};
  for (const row of page.el("card").all((e) => e.classes.has("state-row"))) {
    out[row.dataset.row] = {
      label: row.byClass("state-label")[0].textContent,
      value: row.byClass("state-value")[0].textContent,
      basis: row.byClass("state-basis").map((e) => e.textContent),
    };
  }
  return out;
}
const openRole = (page, role) =>
  page
    .legend()
    .find((b) => b.dataset.key === `role:${role}`)
    .click();
const pickInstance = (page, key) =>
  page
    .el("card")
    .find((e) => e.dataset.focus === `instance:${key}`)
    .click();
const dt = (ms) => fmtDateTime(iso(ms));

test("AC-05: three lines of state of an instance with a fake clock - the task, the agent and the workplace; the basis of 'в работе' is the last event of the session (5 minutes ago), not the start (3 hours ago); a repeated start is 'продолжил работу'; 'нет свежих данных' beside another instance in work is a free task at a working place; restarted, finished and unrecorded name their own moment; a role with nothing in work is free", async () => {
  const now = T0 + 3 * HOUR;
  const s1start = T0 + 1000;
  const s2start = T0 + 2000;
  const entries = [
    lineAt("SessionStart", "S1", T0),
    sub("S1", "i1", s1start, "Plan"),
    lineAt("SessionStart", "S2", T0 + 1500),
    sub("S2", "i2", s2start, "Plan"),
    tool("S1", now - MIN5, "tu-late"),
  ];
  const page = await loaded(entries, [], { now });
  openRole(page, "Plan");
  let rows = stateRows(page);
  assert.deepEqual(
    Object.values(rows).map((r) => r.label),
    ["Задача", "Агент", "Рабочее место"],
  );
  assert.equal(rows.task.value, "в работе");
  assert.deepEqual(rows.task.basis, [
    `последнее событие сессии ${dt(now - MIN5)} · 5 мин назад · если событий нет дольше 60 минут, пишется «нет свежих данных»`,
    `получил задание и начал работу · ${dt(s1start)}`,
  ]);
  assert.equal(
    rows.agent.value,
    `получил задание и начал работу · ${dt(s1start)} · 2 ч 59 мин назад`,
  );
  assert.deepEqual(rows.agent.basis, [
    "о других действиях агента — чтении файлов, командах, правках — Claude Code не сообщает",
  ]);
  assert.equal(
    rows.workplace.value,
    "работает — у этой роли задач «в работе»: 1",
  );
  assert.deepEqual(rows.workplace.basis, [
    "Стол на холсте — изображение роли, общее для всех её запусков, а не компьютер. О компьютере и операционной системе Pixel Office ничего не знает.",
  ]);
  // the other instance: no fresh data, at a working place - the rows differ
  pickInstance(page, "i2");
  rows = stateRows(page);
  assert.equal(rows.task.value, "нет свежих данных");
  assert.equal(
    rows.task.basis[0],
    `последнее событие сессии ${dt(s2start)} · 2 ч 59 мин назад · если событий нет дольше 60 минут, пишется «нет свежих данных»`,
  );
  assert.equal(
    rows.workplace.value,
    "работает — у этой роли задач «в работе»: 1",
  );
  assert.notEqual(rows.task.value, rows.workplace.value);
  // the templates are constants; the workplace starts with the word of the legend
  assert.ok(TX.WORKPLACE_WORKING.startsWith(TX.LEGEND_WORKING));
  assert.ok(TX.WORKPLACE_IDLE.startsWith(TX.LEGEND_IDLE));
  assert.equal(
    TX.FRESH_LIMIT,
    "если событий нет дольше {m} минут, пишется «нет свежих данных»",
  );
  assert.equal(
    TX.SERVER_STARTED,
    "сервер запущен {time} — после последнего начала этого агента",
  );

  // a repeated start: "продолжил работу" with the time of the second start
  const again = [
    lineAt("SessionStart", "S1", T0),
    sub("S1", "r1", T0 + 1000, "Plan"),
    subEnd("S1", "r1", T0 + 2000, "Plan"),
    sub("S1", "r1", now - 10 * 60 * 1000, "Plan"),
  ];
  const pa = await loaded(again, [], { now });
  openRole(pa, "Plan");
  rows = stateRows(pa);
  assert.equal(rows.task.value, "в работе");
  assert.equal(
    rows.task.basis[1],
    `продолжил работу · ${dt(now - 10 * 60 * 1000)}`,
  );
  assert.equal(
    rows.agent.value,
    `продолжил работу · ${dt(now - 10 * 60 * 1000)} · 10 мин назад`,
  );

  // restarted: the earliest server start after the last start, no age
  const boot = [
    lineAt("SessionStart", "S1", T0),
    sub("S1", "b1", T0 + 1000, "Plan"),
  ];
  const pb = await loaded(
    boot,
    [startRec(0, T0 + 500), startRec(2, T0 + 3000), startRec(2, T0 + 9000)],
    { now },
  );
  openRole(pb, "Plan");
  rows = stateRows(pb);
  assert.equal(
    rows.task.value,
    "сервер перезапускался, события не записывались",
  );
  assert.deepEqual(rows.task.basis, [
    `сервер запущен ${dt(T0 + 3000)} — после последнего начала этого агента`,
  ]);
  assert.equal(rows.task.basis[0].includes("назад"), false);
  assert.equal(
    rows.workplace.value,
    "свободен — по журналу у этой роли нет задачи «в работе»; это вывод по событиям, а не событие",
  );

  // finished: the time of the last SubagentStop
  const done = [
    lineAt("SessionStart", "S1", T0),
    sub("S1", "d1", T0 + 1000, "Plan"),
    subEnd("S1", "d1", T0 + 4000, "Plan"),
  ];
  const pd = await loaded(done, [], { now });
  openRole(pd, "Plan");
  rows = stateRows(pd);
  assert.equal(rows.task.value, "закончила работу, итог не записан");
  assert.deepEqual(rows.task.basis, [
    `закончил работу и вернул ответ · ${dt(T0 + 4000)}`,
  ]);
  assert.equal(
    rows.agent.value,
    `закончил работу и вернул ответ · ${dt(T0 + 4000)} · 2 ч 59 мин назад`,
  );
  assert.ok(rows.workplace.value.startsWith("свободен"));

  // unrecorded: the time of the SessionEnd after the start
  const ended = [
    lineAt("SessionStart", "S1", T0),
    sub("S1", "u1", T0 + 1000, "Plan"),
    lineAt("SessionEnd", "S1", T0 + 5000),
  ];
  const pu = await loaded(ended, [], { now });
  openRole(pu, "Plan");
  rows = stateRows(pu);
  assert.equal(rows.task.value, "окончание не записано");
  assert.deepEqual(rows.task.basis, [
    `Закрыт разговор с Claude Code · ${dt(T0 + 5000)}`,
  ]);
  for (const p of [page, pa, pb, pd, pu]) {
    assert.doesNotMatch(p.text("card"), SERVICE_WORDS);
  }
});

// ------------------------------------------------------------------ AC-06

test("AC-06: the lines of the handoff of an instance by rule z - the foreground order (start, stop, handoff), two starts and two stops, no handoff, a handoff without a description, two handoffs of different calls, two lines of one call; a marked line changes nothing; on 300 random journals the current task and the launcher equal the description and the launcher of the model", async () => {
  const s = (n) => T0 + n * 1000;
  const card = (entries, key = "a1") => {
    const m = buildModel(entries, [], s(100));
    return buildInstanceCard(m, buildOffice(m), key);
  };
  const handoff = (n, id, extra = {}) =>
    lineAt("PostToolUse", "S1", s(n), {
      tool_use_id: id,
      launched_agent_id: "a1",
      subagent_type: "Plan",
      ...extra,
    });
  // the foreground order: start, stop, then the handoff
  const fg = [
    lineAt("SessionStart", "S1", s(1)),
    sub("S1", "a1", s(2), "Plan"),
    subEnd("S1", "a1", s(3), "Plan"),
    handoff(4, "tu1", { description: "план" }),
  ];
  let c = card(fg);
  assert.equal(
    c.agent_event.kind,
    "stop",
    "the handoff is not an act of the agent",
  );
  assert.equal(c.agent_event.at, iso(s(3)));
  assert.equal(c.given.length, 1);
  assert.equal(c.given[0].description, "план");
  assert.deepEqual(c.given[0].by, { kind: "main" });
  assert.deepEqual(c.current_task, { kind: "described", text: "план" });
  assert.equal(c.task_state.state, "completed");
  // two starts and two stops
  const twice = [
    ...fg.slice(0, 3),
    sub("S1", "a1", s(5), "Plan"),
    subEnd("S1", "a1", s(6), "Plan"),
  ];
  c = card(twice);
  assert.deepEqual(
    c.starts.map((x) => x.kind),
    ["start", "resume"],
  );
  assert.equal(c.returns.length, 2);
  // no handoff at all
  c = card(fg.slice(0, 3));
  assert.deepEqual(c.current_task, { kind: "no_link" });
  assert.deepEqual(c.launcher, { kind: "none", reason: "no_link" });
  // a handoff without a description
  c = card([...fg.slice(0, 3), handoff(4, "tu1")]);
  assert.deepEqual(c.current_task, { kind: "no_description" });
  assert.deepEqual(c.launcher, { kind: "main" });
  // two handoffs of different calls: not established
  c = card([...fg, handoff(5, "tu2", { description: "другое" })]);
  assert.deepEqual(c.current_task, { kind: "several" });
  assert.deepEqual(c.launcher, { kind: "none", reason: "several" });
  assert.equal(c.given.length, 2);
  // two lines of one call: one handoff
  c = card([...fg, handoff(5, "tu1", { description: "план" })]);
  assert.equal(c.given.length, 1);
  assert.deepEqual(c.current_task, { kind: "described", text: "план" });
  // a marked line with the same agent_id changes nothing
  const before = card(twice);
  const after = card([
    ...twice,
    { ...subEnd("S1", "a1", s(7), "Plan"), source: "SIMULATION" },
    { ...handoff(8, "tu9", { description: "подделка" }), source: "SIMULATION" },
  ]);
  for (const k of [
    "current_task",
    "launcher",
    "given",
    "starts",
    "returns",
    "agent_event",
    "task_state",
  ]) {
    assert.deepEqual(after[k], before[k], k);
  }
  // the constants of what the card cannot know, on the page
  const page = await loaded(fg, [], { now: s(100) });
  openRole(page, "Plan");
  assert.deepEqual(
    page
      .el("card")
      .byClass("card-unknown")
      .map((e) => e.textContent),
    [
      "О сообщениях между агентами Claude Code не сообщает: известны только передачи задания и окончания работы",
      "Об ошибках и о том, что агент ждёт человека, Claude Code сейчас не сообщает",
    ],
  );
  const given = page.el("card").find((e) => e.dataset.part === "given");
  assert.equal(
    given.byClass("entry-note")[0].textContent,
    "Эту запись пишет тот, кто передал задание. Если он ждёт ответа агента, запись приходит после окончания работы агента; если агент работает параллельно — сразу при запуске. Это не действие самого агента",
  );
  // 300 random journals: the card says what the model says (rule z)
  const rand = rng(4646);
  const pick = (list) => list[Math.floor(rand() * list.length)];
  for (let round = 0; round < 300; round++) {
    const e = [lineAt("SessionStart", "S1", s(0))];
    const size = 2 + Math.floor(rand() * 10);
    for (let i = 1; i <= size; i++) {
      const kind = pick(["start", "start", "stop", "post", "post", "forged"]);
      const agent = pick(["a1", "a2"]);
      if (kind === "start")
        e.push(sub("S1", agent, s(i), pick(["Plan", "Explore"])));
      else if (kind === "stop") e.push(subEnd("S1", agent, s(i), "Plan"));
      else {
        const line = lineAt("PostToolUse", "S1", s(i), {
          tool_use_id: pick(["t1", "t2", "t3"]),
          launched_agent_id: agent,
          ...(rand() < 0.6 ? { description: pick(["одно", "другое"]) } : {}),
          ...(rand() < 0.4
            ? { agent_id: pick(["a1", "a2"]), agent_type: "Plan" }
            : {}),
        });
        e.push(kind === "forged" ? { ...line, source: "SIMULATION" } : line);
      }
    }
    const m = buildModel(e, [], s(100));
    const o = buildOffice(m);
    for (const task of m.tasks) {
      const data = buildInstanceCard(m, o, task.key);
      const where = `round ${round}, ${task.key}`;
      if (typeof task.description === "string" && task.description !== "") {
        assert.deepEqual(
          data.current_task,
          { kind: "described", text: task.description },
          where,
        );
      } else {
        assert.notEqual(data.current_task.kind, "described", where);
      }
      if (task.launched_by === null) {
        assert.equal(data.launcher.kind, "none", where);
      } else if (task.launched_by.kind === "main") {
        assert.equal(data.launcher.kind, "main", where);
      } else {
        assert.equal(data.launcher.kind, "subagent", where);
        assert.equal(data.launcher.key, task.launched_by.agent_id, where);
      }
    }
  }
});

// ------------------------------------------------------------------ AC-07

test("AC-07: links only by equal identifiers - in the chain main session -> A -> B the card of B names A as its launcher (a button), the card of A names B among the launched and the main session as its launcher (a button to the card of the main session); a handoff of the same session in the same second to another agent links nothing; a launched agent without a task is an item without a button; the button of B in the card of A opens the card of B with the focus on the cross", async () => {
  const s = (n) => T0 + n * 1000;
  const entries = [
    lineAt("SessionStart", "S1", s(1)),
    lineAt("PostToolUse", "S1", s(2), {
      tool_use_id: "tuA",
      launched_agent_id: "agentA",
      subagent_type: "Plan",
      description: "дело A",
    }),
    sub("S1", "agentA", s(3), "Plan"),
    lineAt("PostToolUse", "S1", s(4), {
      tool_use_id: "tuB",
      launched_agent_id: "agentB",
      subagent_type: "Explore",
      description: "дело B",
      agent_id: "agentA",
      agent_type: "Plan",
    }),
    // the same session and the same second, another agent: no link
    lineAt("PostToolUse", "S1", s(4), {
      tool_use_id: "tuZ",
      launched_agent_id: "nobody-at-all",
      subagent_type: "Explore",
    }),
    sub("S1", "agentB", s(4), "Explore"),
    // A launches an agent whose start is not in the journal
    lineAt("PostToolUse", "S1", s(5), {
      tool_use_id: "tuG",
      launched_agent_id: "ghost-agent",
      subagent_type: "Explore",
      agent_id: "agentA",
      agent_type: "Plan",
    }),
  ];
  const page = await loaded(entries, [], { now: s(10) });
  const m = page.app.getModel();
  const o = page.app.getOffice();
  const a = buildInstanceCard(m, o, "agentA");
  const b = buildInstanceCard(m, o, "agentB");
  assert.deepEqual(a.launcher, { kind: "main" });
  assert.equal(b.launcher.kind, "subagent");
  assert.equal(b.launcher.key, "agentA");
  assert.equal(b.launcher.has_task, true);
  assert.deepEqual(
    a.launched.map((x) => [x.key, x.has_task]),
    [
      ["agentB", true],
      ["ghost-agent", false],
    ],
  );
  assert.deepEqual(b.launched, []);
  // the page: the card of A
  openRole(page, "Plan");
  const box = page.el("card");
  assert.equal(box.byClass("card-launcher")[0].textContent, "Основная сессия");
  // REQ-047, criterion 2 (d): one link - a button "Основная сессия" inside the
  // line of the launcher, to the card of the main session
  const links = box.byClass("card-link");
  assert.equal(links.length, 1);
  assert.equal(links[0].tagName, "BUTTON");
  assert.equal(links[0].textContent, "Основная сессия");
  assert.ok(
    box.byClass("card-launcher")[0].all((e) => e === links[0]).length === 1,
  );
  const launched = box.find((e) => e.dataset.part === "launched");
  const toB = launched.find((e) => e.dataset.focus === "launched:agentB");
  assert.equal(toB.tagName, "BUTTON");
  assert.equal(
    launched.all((e) => e.dataset.focus === "launched:ghost-agent").length,
    0,
  );
  assert.ok(launched.textContent.includes("Explore · ghost-ag"));
  // the button of B opens the card of B, the focus is on the cross
  toB.click();
  assert.equal(page.el("card").byClass("card-id")[0].textContent, "agentB");
  assert.equal(page.el("card").byClass("card-title")[0].textContent, "Explore");
  assert.ok(page.doc.focused === page.el("card").byClass("card-close")[0]);
  const link = page.el("card").byClass("card-link")[0];
  assert.equal(link.dataset.key, "agentA");
  assert.equal(link.textContent, "Plan · agentA");
  // and back by the button of the launcher
  link.click();
  assert.equal(page.el("card").byClass("card-id")[0].textContent, "agentA");
});

// ------------------------------------------------------------------ MK-04

import {
  buildWriteBody,
  validateWriteBody,
} from "../src/pixel-office/protocol.js";

test("MK-04: one role with a secret in SubagentStart, SubagentStop and the subagent_type of the handoff is masked the same way everywhere - one task, one role, one character, the description comes by rule z; the known false alarm of ISS-0058 is written down as literals (recorded, not approved)", () => {
  // an invented key, put together at run time
  const key = ["sk", "ant", "MK04fakeKEY5555555555aaaaaa"].join("-");
  const role = `Plan ${key}`;
  const now = Date.parse("2026-10-05T12:00:30.000Z");
  const t = (s) => `2026-10-05T12:00:${String(s).padStart(2, "0")}.000Z`;
  const through = (input, time) => {
    const body = buildWriteBody(input, time, { storeText: true });
    const checked = validateWriteBody(body, Date.parse(time));
    assert.equal(checked.ok, true, checked.reason);
    return checked.line;
  };
  const entries = [
    through({ session_id: "mk", hook_event_name: "SessionStart" }, t(1)),
    through(
      {
        session_id: "mk",
        hook_event_name: "PostToolUse",
        tool_name: "Agent",
        tool_use_id: "toolu_mk04",
        tool_input: { subagent_type: role, description: "проверить вход" },
        tool_response: { agentId: "agent-mk04" },
      },
      t(2),
    ),
    through(
      {
        session_id: "mk",
        hook_event_name: "SubagentStart",
        agent_id: "agent-mk04",
        agent_type: role,
      },
      t(3),
    ),
    through(
      {
        session_id: "mk",
        hook_event_name: "SubagentStop",
        agent_id: "agent-mk04",
        agent_type: role,
      },
      t(4),
    ),
  ];
  const roles = new Set(
    entries
      .flatMap((e) => [e.agent_type, e.subagent_type])
      .filter((r) => r !== undefined),
  );
  assert.deepEqual([...roles], ["Plan [скрыто]"]);
  const m = buildModel(entries, [], now);
  assert.equal(m.tasks.length, 1);
  assert.equal(m.tasks[0].role, "Plan [скрыто]");
  assert.equal(m.tasks[0].description, "проверить вход");
  const o = buildOffice(m);
  assert.deepEqual(
    o.characters.filter((c) => c.kind === "role").map((c) => c.full),
    ["Plan [скрыто]"],
  );
  assert.equal(JSON.stringify(m).includes("MK04fake"), false);
  // ISS-0058: a name of a file of three parts in a description is hidden too
  const file = through(
    {
      session_id: "mk",
      hook_event_name: "PostToolUse",
      tool_name: "Agent",
      tool_use_id: "toolu_mk04b",
      tool_input: {
        subagent_type: "Plan",
        description: "Шаг 5: тесты pixel-office-panels.test.js",
      },
      tool_response: { agentId: "agent-mk04b" },
    },
    t(5),
  );
  assert.equal(file.description, "Шаг 5: тесты [скрыто]");
  assert.equal(roleName(role), role, "a masked role is not a role of Sai");
});

// ===================================================================
// REQ-048, REQ-046, REQ-047 (design docs/design/REQ-048-049-046-047-interactive.md,
// table 7): the words of the screen, the filters and the search of the journal,
// the card of the main session. The words of the criteria are literals here.
// ===================================================================
import {
  filterJournal,
  journalOptions,
  journalQuery,
  rowAgent,
  searchText,
  taskOfRow,
} from "../src/pixel-office/public/panels.js";
import { buildMainCard } from "../src/pixel-office/public/main-card.js";
import { ageOf } from "../src/pixel-office/public/model.js";

const t48 = (n) => T0 + n * 1000;
const DESIGNER = "Sai Code Designer (CODE-DESIGNER)";
const SECURITY = "Sai Security Reviewer (SECURITY-REVIEWER)";
const shownIndexes = (page) => page.rows().map((r) => Number(r.dataset.index));
const countOf = (page) => {
  const m = / · (\d+) из (\d+)$/.exec(page.text("journal-meta"));
  return m === null ? null : [Number(m[1]), Number(m[2])];
};
// A choice in a list of a filter, as a browser does it: the value, then
// "change".
function choose(page, id, value) {
  const select = page.el(id);
  select.value = value;
  select.fire("change");
}
function typeIn(page, text) {
  const input = page.el("journal-search");
  input.value = text;
  input.fire("input");
}
const optionsOf = (page, id) =>
  page.el(id).children.map((o) => [o.value, o.textContent]);
const toggleOf = (page, index) =>
  page
    .rows()
    .find((r) => r.dataset.index === String(index))
    .byClass("row-toggle")[0];
const linkOf = (page, index, focus) =>
  page
    .rows()
    .find((r) => r.dataset.index === String(index))
    ?.find((e) => e.dataset.focus === focus) ?? null;

// Two sessions, three roles, the main session and a record of the orchestrator
// (criterion 1 REQ-046); roles named "main" and "orch" stay roles.
function filtersJournal() {
  const owner = (s, n) =>
    lineAt("UserPromptSubmit", s, t48(n), { prompt_kind: "owner" });
  const post = (s, n, launched, role, by = null) =>
    lineAt("PostToolUse", s, t48(n), {
      tool_use_id: `tu-${launched}`,
      launched_agent_id: launched,
      subagent_type: role,
      description: `Образец ${launched}`,
      ...(by === null ? {} : { agent_id: by.id, agent_type: by.role }),
    });
  const start = (s, n, id, role) =>
    lineAt("SubagentStart", s, t48(n), { agent_id: id, agent_type: role });
  const stop = (s, n, id, role) =>
    lineAt("SubagentStop", s, t48(n), { agent_id: id, agent_type: role });
  return [
    lineAt("SessionStart", "S1", t48(1)), // 0
    owner("S1", 2), // 1: main:1
    post("S1", 3, "a1", DESIGNER), // 2: main -> a1
    start("S1", 4, "a1", DESIGNER), // 3
    post("S1", 5, "b1", "Explore", { id: "a1", role: DESIGNER }), // 4: a1 -> b1
    start("S1", 6, "b1", "Explore"), // 5
    stop("S1", 7, "b1", "Explore"), // 6
    start("S1", 8, "a1", DESIGNER), // 7: a repeated start
    {
      time: iso(t48(9)),
      source: "ORCH",
      session_id: "S1",
      request_time: iso(t48(2)),
      note_text: "как понял: образец фильтров",
    }, // 8
    stop("S1", 10, "a1", DESIGNER), // 9
    lineAt("Stop", "S1", t48(11)), // 10: closes main:1
    lineAt("SessionStart", "S2", t48(12)), // 11
    owner("S2", 13), // 12: main:12
    post("S2", 14, "c1", "Plan"), // 13
    start("S2", 15, "c1", "Plan"), // 14
    post("S2", 16, "a2", DESIGNER), // 15: main -> a2 (to A, not by A)
    start("S2", 17, "a2", DESIGNER), // 16
    stop("S2", 18, "a2", DESIGNER), // 17
    stop("S2", 19, "c1", "Plan"), // 18
    start("S2", 20, "x1", "main"), // 19: a role named "main"
    start("S2", 21, "x2", "orch"), // 20: a role named "orch"
  ];
}

test("JN-01: the filters of the journal - every filter alone and 'Сессия' + 'Агент' + 'Тип события' together give exactly their rows and the count 'N из M'; 'Агент' = A gives the starts, repeats and ends of A and the handoffs made by A, not the handoffs to A from others; 'Задача' of A1 and of a row of the main session; the variants come only from the journal, roles named 'main' and 'orch' are roles of their own; the literals of 'Тип события'; the choice survives a new line; 'Работа' and 'Офис' are as before; an empty choice says so and 'Сбросить фильтры' resets", async () => {
  const entries = filtersJournal();
  const page = await loaded(entries, [], { now: t48(60) });
  const all = entries.map((_, i) => i);
  assert.deepEqual(shownIndexes(page), all);
  assert.deepEqual(countOf(page), [21, 21]);
  // the variants: the sessions of the journal, the agents, the 11 types
  assert.deepEqual(optionsOf(page, "filter-session"), [
    ["", "все сессии"],
    ["S1", `Сессия S1 · с ${fmtDateTime(iso(t48(1)))}`],
    ["S2", `Сессия S2 · с ${fmtDateTime(iso(t48(12)))}`],
  ]);
  const agents = optionsOf(page, "filter-agent");
  assert.deepEqual(agents.slice(0, 3), [
    ["", "все агенты"],
    ["main", "Основная сессия"],
    ["orch", "Оркестратор"],
  ]);
  assert.deepEqual(
    agents
      .slice(3)
      .map(([v, l]) => `${v}=${l}`)
      .sort(),
    [
      `role:${DESIGNER}=${roleName(DESIGNER)}`,
      "role:Explore=Explore",
      "role:Plan=Plan",
      "role:main=main",
      "role:orch=orch",
    ].sort(),
  );
  assert.deepEqual(optionsOf(page, "filter-type"), [
    ["", "все типы"],
    ["session_start", "Открыт разговор с Claude Code"],
    ["session_end", "Закрыт разговор с Claude Code"],
    ["prompt_owner", "Владелец отправил запрос"],
    ["prompt_service", "В сессию пришло служебное сообщение"],
    ["prompt_unknown", "В сессию пришло сообщение"],
    ["stop", "Основная сессия вернула ответ"],
    ["agent_start", "Агент получил задание и начал работу"],
    ["agent_resume", "Агент продолжил работу"],
    ["agent_stop", "Агент закончил работу и вернул ответ"],
    ["handoff", "Задание передано агенту"],
    ["orch_note", "Оркестратор записал, как понял запрос"],
  ]);
  const only = async (id, value, expected) => {
    choose(page, id, value);
    assert.deepEqual(shownIndexes(page), expected, `${id}=${value}`);
    assert.deepEqual(countOf(page), [expected.length, expected.length]);
    choose(page, id, "");
    assert.deepEqual(shownIndexes(page), all);
  };
  await only("filter-session", "S2", [11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
  // A: its starts (7 is a repeat), its ends and the handoff made by a1 (4);
  // not the handoffs to A from the main session (2, 15)
  await only("filter-agent", `role:${DESIGNER}`, [3, 4, 7, 9, 16, 17]);
  await only("filter-agent", "main", [0, 1, 2, 10, 11, 12, 13, 15]);
  await only("filter-agent", "orch", [8]);
  // a role named "main" or "orch" is not the main session or the orchestrator
  await only("filter-agent", "role:main", [19]);
  await only("filter-agent", "role:orch", [20]);
  await only("filter-type", "agent_start", [3, 5, 14, 16, 19, 20]);
  await only("filter-type", "agent_resume", [7]);
  await only("filter-type", "handoff", [2, 4, 13, 15]);
  // together (AND)
  choose(page, "filter-session", "S2");
  choose(page, "filter-agent", `role:${DESIGNER}`);
  choose(page, "filter-type", "agent_start");
  assert.deepEqual(shownIndexes(page), [16]);
  assert.deepEqual(countOf(page), [1, 1]);
  assert.equal(page.text("journal-filters"), "Фильтры: выбраны");
  // a new line keeps the choice
  await page.push(
    lineAt("SubagentStart", "S2", t48(22), {
      agent_id: "a3",
      agent_type: DESIGNER,
    }),
  );
  assert.equal(page.el("filter-session").value, "S2");
  assert.equal(page.el("filter-agent").value, `role:${DESIGNER}`);
  assert.equal(page.el("filter-type").value, "agent_start");
  assert.deepEqual(shownIndexes(page), [16, 21]);
  assert.deepEqual(countOf(page), [2, 2]);
  // nothing matches: the text and "Сбросить фильтры"
  choose(page, "filter-type", "session_end");
  assert.deepEqual(shownIndexes(page), []);
  const empty = page.el("journal").byClass("journal-empty")[0];
  assert.equal(empty.dataset.reason, "filtered");
  assert.equal(
    empty.byClass("empty-title")[0].textContent,
    "Под выбранные фильтры не подходит ни одно событие",
  );
  const reset = empty.all((e) => e.tagName === "BUTTON");
  assert.deepEqual(
    reset.map((b) => b.textContent),
    ["Сбросить фильтры"],
  );
  reset[0].click();
  assert.equal(shownIndexes(page).length, 22);
  for (const id of ["filter-session", "filter-agent", "filter-type"]) {
    assert.equal(page.el(id).value, "", id);
  }
  assert.equal(page.text("journal-filters"), "Фильтры");
  // "Задача" of a1: its start, repeat, end, the handoff to it and the one made
  // by it - set by "события этой задачи" in the details of its start
  toggleOf(page, 3).click();
  linkOf(page, 3, "go:task-events").click();
  assert.deepEqual(shownIndexes(page), [2, 3, 4, 7, 9]);
  assert.deepEqual(countOf(page), [5, 5]);
  assert.equal(
    page.el("journal-task-mark").byClass("task-mark-text")[0].textContent,
    `Задача: ${roleName(DESIGNER)} a1`,
  );
  // the mark is cleared by its button
  page.el("journal-task-mark").byClass("task-mark-clear")[0].click();
  assert.equal(page.el("journal-task-mark").hidden, true);
  assert.equal(shownIndexes(page).length, 22);
  // "Задача" of a row of the main session: its request, its Stop and its
  // record
  toggleOf(page, 1).click();
  linkOf(page, 1, "go:task-events").click();
  assert.deepEqual(shownIndexes(page), [1, 8, 10]);
  assert.equal(
    page.el("journal-task-mark").byClass("task-mark-text")[0].textContent,
    "Задача: Основная сессия",
  );
  // "Работа" and "Офис" give the rows of before (filterJournal)
  page.el("journal-task-mark").byClass("task-mark-clear")[0].click();
  const m = page.app.getModel();
  const rows = journalRows(m, page.app.getOffice());
  for (const name of ["work", "office"]) {
    page.el(`filter-${name}`).click();
    assert.deepEqual(
      shownIndexes(page),
      filterJournal(rows, name).rows.map((r) => r.index),
      name,
    );
  }
  page.el("filter-all").click();
  // the pure functions agree with the page
  const h = buildHistory(m);
  const q = (over) =>
    journalQuery(
      rows,
      {
        base: "all",
        session: null,
        agent: null,
        type: null,
        task: null,
        search: "",
        shown: 200,
        ...over,
      },
      { model: m, history: h },
    ).rows.map((r) => r.index);
  assert.deepEqual(q({ agent: "main", session: "S1" }), [0, 1, 2, 10]);
  assert.deepEqual(q({ task: { kind: "task", key: "b1" } }), [4, 5, 6]);
  assert.deepEqual(
    rows.map((r) => rowAgent(r, m.entries[r.index])).slice(0, 5),
    ["main", "main", "main", `role:${DESIGNER}`, `role:${DESIGNER}`],
  );
  assert.deepEqual(taskOfRow(m, h, 4), [
    { kind: "task", key: "a1" },
    { kind: "task", key: "b1" },
  ]);
  const opts = journalOptions(rows, m, page.app.getOffice());
  assert.deepEqual(
    opts.sessions.map((s) => s.id),
    ["S1", "S2"],
  );
});

// 450 lines: the request with a text, two tasks with descriptions, a record
// of the orchestrator, then pairs of requests and answers.
function longJournal() {
  const j = journal();
  j.sessionStart("S1"); // 0
  j.ownerPrompt("S1", "Тайная-фраза-JN02"); // 1
  j.post("S1", "tu-a", "agent-jn02-a", {
    subagentType: SECURITY,
    description: "Образец Неповторимый-Фрагмент",
  }); // 2
  j.subStart("S1", "agent-jn02-a", SECURITY); // 3
  j.subStart("S1", "agent-jn02-cd", DESIGNER); // 4
  j.post("S1", "tu-b", "agent-jn02-b", {
    subagentType: "Explore",
    description: "Образец другой задачи",
    byId: "agent-jn02-cd",
    byType: DESIGNER,
  }); // 5
  j.subStart("S1", "agent-jn02-b", "Explore"); // 6
  j.subStop("S1", "agent-jn02-b", "Explore"); // 7
  j.subStop("S1", "agent-jn02-a", SECURITY); // 8
  j.note({
    session_id: "S1",
    request_time: j.entries[1].time,
    note_text: "как понял: Особая-Запись-JN02",
  }); // 9
  j.stop("S1"); // 10
  j.sessionStart("S2"); // 11
  while (j.entries.length < 450) {
    if (j.entries.length % 2 === 0) j.prompt("S2");
    else j.stop("S2");
  }
  return j.entries;
}

test("JN-02: the search and the earlier rows - 450 rows: '200 из 450', 'Показать более ранние' gives '400 из 450' (a new line keeps it: '400 из 451'), then all and no button; a change of the search shows the last 200 again; the search finds the rows of a task by a piece of its description, by a full agent_id, in another case, by the text of a record; the text of prompt_text finds nothing; the code of the role of the receiver does not find the handoff, the code of the giver does", async () => {
  const entries = longJournal();
  assert.equal(entries.length, 450);
  const page = await loaded(entries, [], { now: T0 + 1000 * 1000 });
  const earlier = () =>
    page
      .el("journal")
      .byClass("journal-earlier")
      .flatMap((li) => li.all((e) => e.tagName === "BUTTON"));
  assert.deepEqual(countOf(page), [200, 450]);
  assert.deepEqual(
    earlier().map((b) => b.textContent),
    ["Показать более ранние"],
  );
  // the button stands first, over the earliest shown row
  assert.ok(page.el("journal").children[0].classes.has("journal-earlier"));
  assert.equal(shownIndexes(page)[0], 250);
  earlier()[0].click();
  assert.deepEqual(countOf(page), [400, 450]);
  assert.equal(shownIndexes(page)[0], 50);
  // a new line keeps what is shown (the limit changes only with a filter or
  // the search)
  await page.push(lineAt("UserPromptSubmit", "S2", T0 + 900 * 1000));
  assert.deepEqual(countOf(page), [400, 451]);
  assert.equal(shownIndexes(page)[0], 51);
  earlier()[0].click();
  assert.deepEqual(countOf(page), [451, 451]);
  assert.equal(shownIndexes(page)[0], 0);
  assert.deepEqual(earlier(), []);
  const found = (text) => {
    typeIn(page, text);
    return shownIndexes(page);
  };
  assert.deepEqual(found("Неповторимый-Фрагмент"), [2, 3, 8]);
  assert.deepEqual(countOf(page), [3, 3]);
  assert.deepEqual(found("неповторимый-фрагмент"), [2, 3, 8], "case");
  assert.deepEqual(found("  agent-jn02-a  "), [2, 3, 8], "trimmed id");
  assert.deepEqual(found("AGENT-JN02-B"), [5, 6, 7]);
  assert.deepEqual(found("особая-запись-jn02"), [9]);
  // prompt_text is not looked in
  assert.deepEqual(found("Тайная-фраза-JN02"), []);
  assert.equal(
    page.el("journal").byClass("empty-title")[0].textContent,
    "Под выбранные фильтры не подходит ни одно событие",
  );
  // L2: the code of the receiver does not find its handoff (only the start
  // and the end of the agent); the code of the giver finds the handoff
  assert.deepEqual(found("SECURITY-REVIEWER"), [3, 8]);
  assert.deepEqual(found("CODE-DESIGNER"), [4, 5]);
  // an empty search does nothing; the show is the last 200 again
  assert.deepEqual(found(""), shownIndexes(page));
  assert.deepEqual(countOf(page), [200, 451]);
  // the pure search text
  const m = page.app.getModel();
  const rows = journalRows(m, page.app.getOffice());
  const textOf = (i) =>
    searchText(
      rows.find((r) => r.index === i),
      m.entries[i],
    );
  assert.equal(textOf(1).includes("тайная-фраза"), false);
  assert.equal(textOf(2).includes("security-reviewer"), false);
  assert.ok(textOf(5).includes("code-designer"));
  assert.ok(textOf(5).includes("agent-jn02-cd"));
});

// Two sessions: in the first two requests of the owner and a service message;
// in the second only SessionStart; a third session with a task of its own.
function mainCardJournal() {
  const owner = (s, n) =>
    lineAt("UserPromptSubmit", s, t48(n), {
      prompt_kind: "owner",
      prompt_text: "Образец запроса",
    });
  const post = (s, n, id, role) =>
    lineAt("PostToolUse", s, t48(n), {
      tool_use_id: `tu-${id}`,
      launched_agent_id: id,
      subagent_type: role,
      description: `Образец ${id}`,
    });
  const start = (s, n, id, role) =>
    lineAt("SubagentStart", s, t48(n), { agent_id: id, agent_type: role });
  return [
    lineAt("SessionStart", "S1", t48(1)), // 0
    owner("S1", 2), // 1: main:1
    post("S1", 3, "a1", "Plan"), // 2
    start("S1", 4, "a1", "Plan"), // 3
    lineAt("SubagentStop", "S1", t48(5), {
      agent_id: "a1",
      agent_type: "Plan",
    }), // 4
    lineAt("Stop", "S1", t48(6)), // 5: main:1 completed
    owner("S1", 7), // 6: main:6
    post("S1", 8, "a2", "Explore"), // 7
    start("S1", 9, "a2", "Explore"), // 8
    lineAt("UserPromptSubmit", "S1", t48(10), { prompt_kind: "service" }), // 9: main:9
    lineAt("SessionStart", "S2", t48(11)), // 10: only SessionStart
    owner("S3", 12), // 11: main:11
    post("S3", 13, "a3", "Plan"), // 12
    start("S3", 14, "a3", "Plan"), // 13
  ];
}

test("MC-01: the card of the main session - two sessions (two requests and a service message; only SessionStart): the basis and the time of each row in each state, the age of 'в работе' and 'нет свежих данных', 'кого запустила в этом запросе' without the tasks of the second request and of other sessions, the switch of rows and sessions, 'запросов в этой сессии не записано'; 'разговоров идёт: N' only inside 'Вся основная сессия'", async () => {
  const entries = mainCardJournal();
  const lastAt = iso(t48(14));
  const card = (page) => page.el("card");
  const rowsOf = (page) => {
    const out = {};
    for (const row of card(page).all((e) => e.classes.has("state-row"))) {
      out[row.dataset.row] = {
        value: row.byClass("state-value")[0].textContent,
        basis: row.byClass("state-basis").map((e) => e.textContent),
      };
    }
    return out;
  };
  const press = (page, focus) =>
    card(page)
      .find((e) => e.dataset.focus === focus)
      .click();
  const openPart = (page, part) =>
    card(page)
      .find((e) => e.dataset.part === part)
      .children[0].click();
  const fresh = "если событий нет дольше 60 минут, пишется «нет свежих данных»";

  // in work: the last request (the service message) of S1; S1 last event at 9
  let now = t48(30);
  let page = await loaded(entries, [], { now });
  page
    .legend()
    .find((b) => b.dataset.key === "main")
    .click();
  assert.equal(card(page).dataset.kind, "main");
  assert.equal(
    card(page).byClass("card-title")[0].textContent,
    "Основная сессия",
  );
  // the first row of the main session in the order of the list (rule d)
  const m = page.app.getModel();
  const first = m.list.find((item) => item.kind === "main");
  assert.equal(card(page).byClass("card-id")[0].textContent, first.session_id);
  // the card shows that row: the other rows of its session are the rest
  const others = card(page)
    .all((e) => /^row:/.test(e.dataset.focus ?? ""))
    .map((e) => e.dataset.focus.slice(4));
  assert.deepEqual(
    [first.key, ...others].sort(),
    m.mainRows
      .filter((r) => r.session_id === first.session_id)
      .map((r) => r.key)
      .sort(),
  );
  // go to main:9 of S1 by the list of the other rows (or it is the first)
  const toRow = (p, key) => {
    const button = card(p).find((e) => e.dataset.focus === `row:${key}`);
    if (button !== null) {
      openPart(p, "rows");
      card(p)
        .find((e) => e.dataset.focus === `row:${key}`)
        .click();
    }
  };
  const ageAt = (at, clock) => ageText(ageOf(at, clock));
  const s1Last = iso(t48(10));
  // S1 rows by their state at this clock
  const h = buildHistory(m);
  const o = page.app.getOffice();
  const data = (row, session = "S1") =>
    buildMainCard(m, o, h, { row, session });
  assert.equal(data("main:1").row.state, "completed");
  assert.equal(data("main:6").row.state, "unrecorded");
  assert.equal(data("main:9").row.state, "in_progress");
  // the card on main:9: in work, the basis with the age, the request
  if (first.key !== "main:9") {
    page
      .legend()
      .find((b) => b.dataset.key === "main")
      .click();
  }
  const onRow = async (p, key) => {
    if (card(p).byClass("card-id")[0].textContent !== "S1") {
      openPart(p, "sessions");
      press(p, "session:S1");
    }
    toRow(p, key);
  };
  await onRow(page, "main:9");
  let st = rowsOf(page);
  assert.equal(st.task.value, "в работе");
  assert.deepEqual(st.task.basis, [
    `последнее событие сессии ${fmtDateTime(s1Last)} · ${ageAt(s1Last, now)} · ${fresh}`,
    `В сессию пришло служебное сообщение · ${fmtDateTime(iso(t48(10)))}`,
  ]);
  assert.ok(ageAt(s1Last, now) !== "");
  // main:1: finished - "Основная сессия вернула ответ" and the time of Stop
  await onRow(page, "main:1");
  st = rowsOf(page);
  assert.equal(st.task.value, "закончила работу, итог не записан");
  assert.deepEqual(st.task.basis, [
    `Основная сессия вернула ответ · ${fmtDateTime(iso(t48(6)))}`,
  ]);
  assert.equal(
    card(page).byClass("card-history-note")[0].textContent,
    "историю запроса открывает её строка в панели «Задачи» или в журнале",
  );
  // "кого запустила в этом запросе": a1 only (not a2 of the second request,
  // not a3 of another session)
  openPart(page, "launched");
  const launched = card(page)
    .find((e) => e.dataset.part === "launched")
    .all((e) => e.classes.has("instance"))
    .map((b) => b.dataset.key);
  assert.deepEqual(launched, ["a1"]);
  // main:6: the end not recorded - the next request closed it
  await onRow(page, "main:6");
  st = rowsOf(page);
  assert.equal(st.task.value, "окончание не записано");
  assert.deepEqual(st.task.basis, [
    `В сессию пришло служебное сообщение · ${fmtDateTime(iso(t48(10)))}`,
  ]);
  openPart(page, "launched");
  assert.deepEqual(
    card(page)
      .find((e) => e.dataset.part === "launched")
      .all((e) => e.classes.has("instance"))
      .map((b) => b.dataset.key),
    ["a2"],
  );
  // the other sessions: S2 and S3 with their first time; S2 has no requests
  openPart(page, "sessions");
  const labels = card(page)
    .find((e) => e.dataset.part === "sessions")
    .byClass("instance-id")
    .map((e) => e.textContent)
    .sort();
  assert.deepEqual(labels, [
    `Сессия S2 · с ${fmtDateTime(iso(t48(11)))}`,
    `Сессия S3 · с ${fmtDateTime(iso(t48(12)))}`,
  ]);
  press(page, "session:S2");
  assert.equal(card(page).byClass("card-id")[0].textContent, "S2");
  assert.deepEqual(
    card(page)
      .byClass("task-none")
      .map((e) => e.textContent),
    ["запросов в этой сессии не записано"],
  );
  assert.equal(card(page).byClass("state-row").length, 0);
  // "Вся основная сессия": the former sections and "разговоров идёт: N"
  assert.equal(
    card(page)
      .all((e) => e.classes.has("card-working"))
      .map((e) => e.parentNode.dataset.part)
      .join(),
    "role",
  );
  assert.match(
    card(page).byClass("card-working")[0].textContent,
    /^разговоров идёт: \d+$/,
  );
  // no stale words, no service words in the card
  assert.equal(SERVICE_WORDS.test(card(page).textContent), false);

  // the same journal later: S1 has no event for more than 60 minutes
  now = t48(14) + STALE_AFTER_MS + 60_000;
  page = await loaded(entries, [], { now });
  page
    .legend()
    .find((b) => b.dataset.key === "main")
    .click();
  await onRow(page, "main:9");
  st = rowsOf(page);
  assert.equal(st.task.value, "нет свежих данных");
  assert.equal(
    st.task.basis[0],
    `последнее событие сессии ${fmtDateTime(s1Last)} · ${ageAt(s1Last, now)} · ${fresh}`,
  );
  assert.ok(ageAt(s1Last, now) !== "");

  // a record of a server start after the request: restarted, no age
  now = t48(30);
  const restart = { time: iso(t48(12)), journal_lines: 11 };
  page = await loaded(entries, [restart], { now });
  page
    .legend()
    .find((b) => b.dataset.key === "main")
    .click();
  await onRow(page, "main:9");
  st = rowsOf(page);
  assert.equal(st.task.value, "сервер перезапускался, события не записывались");
  assert.deepEqual(st.task.basis, [
    `сервер запущен ${fmtDateTime(iso(t48(12)))} — после начала этого запроса`,
  ]);
  assert.equal(lastAt, iso(t48(14)));
});

test("LW-04: the words of the screen - the literals of rows 1-27 of the table are the constants; on a journal with all 12 cases, a SIMULATION line and a record with request_time_auto the text of the journal, the details, the header, the card of an instance, the card of the main session and the window has none of the old words outside 'Технические поля'; a service message says 'служебное сообщение' once; the old words are in no string literal of the page and not in index.html", async () => {
  // rows 1-27 of the table "было → стало" (REQ-048), literally
  const rows = [
    [TX.HEADER_BADGE, "Источник событий — Claude Code"],
    [TX.LIVE, "на связи"],
    [TX.EMPTY_JOURNAL, "Событий от Claude Code пока нет"],
    [
      TX.EMPTY_HINT,
      "Видны только разговоры с Claude Code, запущенные в папке sai/: там Claude Code настроен присылать события Pixel Office. Разговоры из другой папки видны, только если в её настройках есть такая же настройка.",
    ],
    [TX.NOT_FROM_HOOKS, "не подтверждена"],
    [TX.MARK_PREFIX, "не подтверждена: "],
    [TX.SOURCE_WORDS.REAL, "Claude Code"],
    [TX.SOURCE_WORDS.other, "не Claude Code"],
    [TX.SOURCE_WORDS.ORCH, "запись оркестратора"],
    [TX.EVENT_TABLE.session_start.words, "Открыт разговор с Claude Code"],
    [
      TX.EVENT_TABLE.session_start.meaning,
      "В Claude Code начат новый разговор (сессия) или продолжен прежний: при продолжении номер сессии тот же. Что именно произошло, Claude Code сейчас не сообщает.",
    ],
    [TX.EVENT_TABLE.session_end.words, "Закрыт разговор с Claude Code"],
    [
      TX.EVENT_TABLE.session_end.meaning,
      "Разговор (сессия) закончился: окно закрыли, разговор очистили или переключили. Причину Claude Code сейчас не сообщает.",
    ],
    [
      TX.EVENT_TABLE.prompt_service.meaning,
      "Сообщение от системы, а не от человека: напоминание, уведомление о задаче, которая шла параллельно, сообщение из другого разговора с Claude Code или пометка о продолжении прежнего разговора. Его текст не хранится.",
    ],
    [
      TX.EVENT_TABLE.stop.not_proved,
      "Не доказывает, что вся работа закончена или удалась: агенты, запущенные параллельно, могут ещё работать, и сессия может продолжить сама, когда они вернутся. При прерывании человеком и при ошибке этого события нет.",
    ],
    [
      TX.EVENT_TABLE.agent_stop.meaning,
      "Агент закончил свой ход и вернул ответ тому, кто его запустил. Текст ответа Pixel Office не хранит: итог не записан. Такое событие присылают и служебные помощники самого Claude Code — их начала в журнале нет, а роль совпадает с ролью разговора или пуста.",
    ],
    [
      TX.EVENT_TABLE.handoff.meaning,
      "Тот, кто передал задание (основная сессия или другой агент), запустил агента, и Claude Code вернул номер запущенного агента. Описание — то, что написал передавший (до 100 знаков). Если агент работает параллельно с тем, кто его запустил, эта запись приходит сразу при запуске; если запустивший ждёт его ответа — после окончания работы агента.",
    ],
    [
      TX.EVENT_TABLE.orch_note.meaning,
      "Запись, которую оркестратор сделал сам; это не событие от Claude Code. К запросу она привязана по времени запроса, если оно записано.",
    ],
    [
      TX.EVENT_TABLE.marked.meaning,
      "Строка есть в журнале, но Pixel Office не признал её настоящим событием от Claude Code.",
    ],
    [TX.EVENT_TABLE.marked.reasons.source, "строку записал не Claude Code"],
    [TX.CARD_INSTANCE, "запуск"],
    [TX.CARD_BLOCKS.ids, "Полные номера и код роли"],
    [TX.CARD_BLOCKS.instances, "Все запуски этой роли"],
    [TX.CARD_BLOCKS.more, "Остальные запуски"],
    [TX.INSTANCES_COUNT, "запусков этой роли: {N}"],
    [TX.COPY_LABEL_AGENT, "Скопировать номер запуска"],
    [
      TX.WORKPLACE_DESK,
      "Стол на холсте — изображение роли, общее для всех её запусков, а не компьютер. О компьютере и операционной системе Pixel Office ничего не знает.",
    ],
    [
      TX.FRESH_LIMIT,
      "если событий нет дольше {m} минут, пишется «нет свежих данных»",
    ],
    [
      TX.AGENT_NOT_RECORDED,
      "о других действиях агента — чтении файлов, командах, правках — Claude Code не сообщает",
    ],
    [
      TX.UNKNOWN_MESSAGES,
      "О сообщениях между агентами Claude Code не сообщает: известны только передачи задания и окончания работы",
    ],
    [
      TX.UNKNOWN_ERRORS,
      "Об ошибках и о том, что агент ждёт человека, Claude Code сейчас не сообщает",
    ],
    [
      TX.GIVEN_NOTE,
      "Эту запись пишет тот, кто передал задание. Если он ждёт ответа агента, запись приходит после окончания работы агента; если агент работает параллельно — сразу при запуске. Это не действие самого агента",
    ],
    [
      TX.HISTORY_NOTE_AUTO,
      "оркестратор не указал запрос — запись отнесена к последнему запросу владельца",
    ],
    [TX.CARD_SESSIONS, "разговоров идёт: "],
  ];
  rows.forEach(([value, literal], i) => assert.equal(value, literal, `#${i}`));
  // the text of the badge in index.html
  const html = fs.readFileSync(path.join(PUBLIC, "index.html"), "utf8");
  assert.ok(html.includes("Источник событий — Claude Code"));
  assert.equal(html.includes("REAL — события хуков"), false);

  // a journal with all 12 cases, a SIMULATION line and a record whose request
  // was chosen automatically
  const base = allKindsJournal().entries;
  const auto = {
    time: iso(T0 + 13_500),
    source: "ORCH",
    session_id: "S1",
    request_time: iso(T0 + 2000),
    request_time_auto: true,
    note_text: "как понял: образец автопривязки",
  };
  const entries = [...base.slice(0, -1), auto, base[base.length - 1]];
  const page = await loaded(entries);
  const OLD =
    /хук|LIVE|REAL|SIMULATION|экземпляр|переднего плана|фонов|pixel-office-note|правило чтения|привязано автоматически|идущих сессий|порог свежести/i;
  // the text that is seen: no hidden element, no "Технические поля"
  const seen = (el) => {
    if (el.hidden === true || el.dataset.part === "tech") return "";
    if (["SCRIPT", "STYLE", "NOSCRIPT"].includes(el.tagName)) return "";
    if (el.children.length === 0) return el.textContent;
    return el.children.map(seen).join(" ");
  };
  const check = (where) => {
    const text = seen(page.doc.root);
    const m = OLD.exec(text);
    assert.equal(m, null, `${where}: '${m?.[0]}'`);
  };
  check("the page");
  const indexes = page.rows().map((r) => r.dataset.index);
  assert.equal(indexes.length, entries.length);
  for (const index of indexes) {
    const toggle = () =>
      page
        .rows()
        .find((r) => r.dataset.index === index)
        .byClass("row-toggle")[0];
    toggle().click();
    const box = page
      .rows()
      .find((r) => r.dataset.index === index)
      .byClass("event-details")[0];
    assert.ok(box !== undefined, index);
    check(`the details of ${index}`);
    toggle().click();
  }
  // the marked SIMULATION line: "не подтверждена", the source in plain words
  const sim = page.rows().find((r) => r.dataset.index === "10");
  assert.equal(sim.dataset.marked, "true");
  assert.equal(sim.byClass("mark")[0].textContent, "не подтверждена");
  // the service message: "служебное сообщение" once in its row
  const service = page.rows().find((r) => r.dataset.index === "2");
  assert.equal(service.textContent.split("служебное сообщение").length - 1, 1);
  // the card of an instance with its parts open
  page
    .legend()
    .find((b) => b.dataset.key === "role:Sai Orchestrator (ORCH)")
    .click();
  for (const d of page.el("card").all((e) => e.tagName === "DETAILS")) {
    d.open = true;
  }
  check("the card of an instance");
  page.doc.fire("keydown", { key: "Escape", preventDefault() {} });
  // the card of the main session with "Вся основная сессия" open
  page
    .legend()
    .find((b) => b.dataset.key === "main")
    .click();
  for (const d of page.el("card").all((e) => e.tagName === "DETAILS")) {
    d.open = true;
  }
  check("the card of the main session");
  page.doc.fire("keydown", { key: "Escape", preventDefault() {} });
  // the window of the request
  page
    .rows()
    .find((r) => r.dataset.index === "1")
    .byClass("history-open")[0]
    .click();
  assert.equal(historyDom(page).isOpen(), true);
  check("the window of history");
  assert.ok(page.text("history-body").includes(TX.HISTORY_SERVICE));
  // the old words in the string literals of the page (comments do not count)
  const OLD_LITERAL =
    /"[^"]*(хук|LIVE|REAL —|экземпляр|переднего плана|фонов|в фоне|pixel-office-note|правило чтения|привязано автоматически|идущих сессий|порог свежести|сессии Claude Code|Сессия Claude Code)[^"]*"/;
  const found = [];
  for (const name of fs.readdirSync(PUBLIC).filter((f) => f.endsWith(".js"))) {
    fs.readFileSync(path.join(PUBLIC, name), "utf8")
      .split("\n")
      .forEach((line, i) => {
        if (/^\s*\/\//.test(line)) return;
        if (OLD_LITERAL.test(line)) found.push(`${name}:${i + 1}`);
      });
  }
  assert.deepEqual(found, []);
});
