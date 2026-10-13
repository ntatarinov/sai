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
  EVENT_LABELS,
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
  assert.equal(nowText(page), "Сейчас: ORCH — check it");
  assert.equal(page.el("now").dataset.busy, "true");
  assert.equal(page.el("now").title, "Сейчас: ORCH — check it");
  // without a description
  j.subStart("S1", "a2", "Explore");
  await page.push(j.entries[j.entries.length - 1]);
  assert.equal(nowText(page), "Сейчас: Explore · и ещё 1 в работе");
  j.subStop("S1", "a2", "Explore");
  j.subStop("S1", "a1", "Sai Orchestrator (ORCH)");
  await page.push(...j.entries.slice(-2));
  assert.equal(nowText(page), "Сейчас: в работе ничего нет");
  // only the main row
  j.prompt("S1");
  await page.push(j.entries[j.entries.length - 1]);
  assert.equal(nowText(page), `Сейчас: ${MAIN_ROW}`);
  // three items in progress: the first text and 'и ещё 2 в работе'
  j.subStart("S1", "b1", "Plan");
  j.subStart("S1", "b2", "Explore");
  await page.push(...j.entries.slice(-2));
  assert.ok(nowText(page).startsWith("Сейчас: Explore"), nowText(page));
  assert.ok(nowText(page).endsWith(" · и ещё 2 в работе"));
  // the link is lost: the last loaded text stays
  const kept = nowText(page);
  page.server.mode = "fail";
  await page.tick(2000);
  assert.equal(nowText(page), kept);
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

test("PN-06: a journal row - time HH:MM:SS, 8 characters of the session, who, the event, the description only of a linked launch, tone, the mark with source and 'не из хуков'; texts from events are text", async () => {
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
  assert.equal(cell(rows[0], "event"), EVENT_LABELS.SessionStart);
  assert.equal(rows[0].dataset.tone, "session");
  assert.equal(cell(rows[1], "who"), "Explore");
  assert.equal(cell(rows[1], "event"), EVENT_LABELS.PostToolUse);
  assert.equal(cell(rows[1], "row-desc"), "linked task");
  assert.equal(rows[1].dataset.tone, "handoff");
  assert.equal(cell(rows[2], "event"), EVENT_LABELS.SubagentStart);
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
  assert.equal(cell(marked, "source"), "SIMULATION");
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
    "Событий от хуков пока нет",
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
  assert.equal(none.textContent, NO_DATA);
  assert.equal(filled.el("filter-work").hidden, false);
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
  assert.equal(orch.byClass("item-role")[0].textContent, "ORCH");
  assert.equal(
    orch.byClass("item-full")[0].textContent,
    "Sai Orchestrator (ORCH)",
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
        (c) => c.op === "fillText" && c.args[0] === "Plan" && c.args[3] === 37,
      ),
    "on the board",
  );
  assert.equal(page.el("card-overlay").hidden, false);
  assert.equal(
    page.el("card").byClass("card-working")[0].textContent,
    "в работе: 1",
  );
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
    page.el("card").byClass("card-working")[0].textContent,
    "в работе: 0",
  );
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

test("PN-19: opening - from a row of the journal and from the button of a card of a task or of the main session, not from the card itself or from the card of an agent; a service message only says so; a row without a window is as it was; the order of the sections", async () => {
  const fx = twoRequests();
  const page = await loaded(fx.j.entries);
  const h = buildHistory(page.app.getModel());
  const k1 = `req:${fx.o1}`;
  const k2 = `req:${fx.o2}`;
  assert.deepEqual([...h.byKey.keys()], [k1, k2]);

  // rows of the journal
  assert.deepEqual(
    historyRows(page).map((r) => r.dataset.request),
    [k1, k2],
  );
  for (const row of historyRows(page)) {
    assert.equal(row.getAttribute("tabindex"), "0");
    const last = row.children[row.children.length - 1];
    assert.equal(last.tagName, "SPAN");
    assert.ok(last.classes.has("history-open"));
    assert.equal(last.textContent, TX.HISTORY_OPEN);
    assert.equal(
      interactive(row).filter((e) => e !== row).length,
      0,
      "no interactive element inside the row",
    );
  }
  const svcRow = page
    .rows()
    .find((r) => r.textContent.includes(TX.HISTORY_SERVICE));
  assert.ok(svcRow !== undefined, "the service message is signed");
  assert.equal(svcRow.classes.has("opens-history"), false);
  assert.equal(svcRow.hasAttribute("tabindex"), false);
  assert.equal(svcRow.hasAttribute("data-request"), false);
  assert.equal(
    svcRow.byClass("history-service")[0].textContent,
    TX.HISTORY_SERVICE,
  );
  const plain = page
    .rows()
    .filter((r) => !r.classes.has("opens-history") && r !== svcRow);
  for (const row of plain) {
    assert.equal(row.hasAttribute("tabindex"), false);
    assert.equal(row.byClass("history-open").length, 0);
    assert.equal(row.byClass("history-service").length, 0);
  }
  // a click on the service row and on a row without a window opens nothing
  svcRow.click();
  for (const row of plain) row.click();
  const dom = historyDom(page);
  assert.equal(dom.isOpen(), false);
  // the row of the first request opens the first window, the second the second
  historyRowOf(page, k1).click();
  assert.equal(dom.isOpen(), true);
  assert.equal(dom.title().textContent, "первый запрос");
  // the order of the sections, top to bottom
  assert.equal(dom.body.children[0].textContent, TX.HISTORY_BADGE);
  assert.deepEqual(
    dom.body.children.slice(3).map((k) => k.dataset.section),
    ["request", "understood", "work", "timeline"],
  );
  dom.close.click();
  historyRowOf(page, k2).click();
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
    if (!expected.has(key)) {
      assert.equal(buttons.length, 0, `${key}: no window, no button`);
      assert.equal(interactive(item).length, 0);
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
      1,
      "the button is the only interactive element",
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
  historyRowOf(page, `req:${o}`).click();
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

test("PN-21: the keyboard and the focus - Enter and Space open from the row, Escape, the cross and the overlay close, the focus returns to the opener, Tab goes round, data-modal on the body; Escape closes only the top window; a card of an agent that is open closes when the window opens", async () => {
  const fx = twoRequests();
  const page = await loaded(fx.j.entries);
  const k1 = `req:${fx.o1}`;
  const dom = historyDom(page);
  const bodyEl = () => page.el("history-overlay").parentNode;
  const modal = () => bodyEl().getAttribute("data-modal");
  const esc = () =>
    page.doc.fire("keydown", { key: "Escape", preventDefault() {} });
  const row = () => historyRowOf(page, k1);
  const focusedIs = (el, why) => assert.ok(page.doc.focused === el, why);
  assert.equal(modal(), null);

  // Enter and Space open; other keys do not
  pressKey(row(), "a");
  pressKey(row(), "Tab");
  assert.equal(dom.isOpen(), false);
  assert.equal(
    pressKey(row(), "Enter") > 0,
    true,
    "the key does not scroll the page",
  );
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
  historyRowOf(page, k2).click();
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
  // the focus outline of a row that opens: inside the scrolling list
  assert.equal(
    top(".row.opens-history:focus-visible").get("outline-offset"),
    "-0.125rem",
  );
  assert.equal(top(".row.opens-history").get("cursor"), "pointer");

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
  assert.equal(page.text("now-text"), "Сейчас: Explore · и ещё 1 в работе");
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
  assert.equal(
    page.text("now-text"),
    "Сейчас: general-purpose · и ещё 2 в работе",
  );
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
  // opened from the row of the journal, too (the same request)
  const page = await loaded([start, ask], [], { now: T0 + 2 * HOUR });
  const opener = page.rows().find((r) => r.classes.has("opens-history"));
  opener.click();
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
