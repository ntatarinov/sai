// PN: the header, the journal, the task panel, the legend and the card
// (design 10.2; REQ-007 criteria 5, 6, 9, 14, 15; REQ-001 criteria 4, 6, 7).
// The page is built by createApp on a DOM parsed from index.html.
import assert from "node:assert/strict";
import { test } from "node:test";
import { buildModel } from "../src/pixel-office/public/model.js";
import { buildLayout } from "../src/pixel-office/public/layout.js";
import { fmtDateTime } from "../src/pixel-office/public/format.js";
import {
  EMPTY_HINT,
  EVENT_LABELS,
  FILTER_LABELS,
  HEADER_BADGE,
  JOURNAL_TITLE,
  LIVE,
  MAIN_ROW,
  NOSCRIPT,
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
  withText,
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
const statsOf = (card) => ({
  id: card.byClass("session-id")[0].textContent,
  stats: card.byClass("session-stats")[0].textContent,
  value: card.byClass("session-progress")[0].value,
  max: card.byClass("session-progress")[0].max,
  running: card.dataset.running,
});

test("PN-10: session summaries - one per running session above 'Текущие', new ones on top, 8 characters, a progress bar and 'задач n/m · ролей k'; a resumed task and two tasks of one role are counted per 4.11; a finished session's summary sits in 'История' above its topmost shown item without '• Идёт'; numbers and places change after an event", async () => {
  const j = journal();
  j.sessionStart("aaaaaaaa-1");
  j.sessionStart("bbbbbbbb-2");
  launch(j, "aaaaaaaa-1", "t1", "Explore");
  launch(j, "aaaaaaaa-1", "t2", "Explore");
  launch(j, "aaaaaaaa-1", "t3", "Plan");
  j.subStop("aaaaaaaa-1", "t1", "Explore");
  // a task resumed in another session counts there
  j.subStart("bbbbbbbb-2", "t3", "Plan");
  j.subStop("bbbbbbbb-2", "t3", "Plan");
  launch(j, "cccccccc-3", "t4", "Explore");
  j.sessionEnd("cccccccc-3");
  const page = await loaded(j.entries);
  const cards = cardsOf(page).map(statsOf);
  const running = cards.filter((c) => c.running === "true");
  assert.deepEqual(
    running.map((c) => c.id),
    ["bbbbbbbb", "aaaaaaaa"],
    "new ones on top",
  );
  const a = running.find((c) => c.id === "aaaaaaaa");
  const b = running.find((c) => c.id === "bbbbbbbb");
  assert.deepEqual([a.value, a.max, a.stats], [1, 2, "задач 1/2 · ролей 1"]);
  assert.deepEqual([b.value, b.max, b.stats], [1, 1, "задач 1/1 · ролей 1"]);
  // the finished session's summary is in the history, above its topmost item, no badge
  const children = page.el("tasks").children;
  const finished = cardsOf(page).find((c) => c.dataset.running === "false");
  assert.ok(finished !== undefined);
  assert.equal(finished.byClass("session-badge").length, 0);
  assert.equal(finished.dataset.session, "cccccccc");
  // a running session has no second summary in the history
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
  // after an event the numbers change
  j.subStop("aaaaaaaa-1", "t2", "Explore");
  await page.push(j.entries[j.entries.length - 1]);
  const a2 = cardsOf(page)
    .map(statsOf)
    .find((c) => c.id === "aaaaaaaa");
  assert.deepEqual([a2.value, a2.stats], [2, "задач 2/2 · ролей 1"]);
  // an unrecorded task is not counted in n
  const u = journal();
  u.sessionStart("uuuuuuuu-1");
  launch(u, "uuuuuuuu-1", "u1", "Explore");
  u.subStop("uuuuuuuu-1", "u1", "Explore");
  launch(u, "uuuuuuuu-1", "u2", "Plan");
  const unrec = await loaded(u.entries, [
    { time: at(99), journal_lines: u.entries.length },
  ]);
  assert.equal(statsOf(cardsOf(unrec)[0]).stats, "задач 1/2 · ролей 2");
  assert.equal(statsOf(cardsOf(unrec)[0]).value, 1);
  // a session without tasks still has a summary while it runs
  const empty = await loaded([entryOf("SessionStart", "sess-empty-1", at(1))]);
  assert.equal(statsOf(cardsOf(empty)[0]).stats, "задач 0/0 · ролей 0");
  assert.equal(statsOf(cardsOf(empty)[0]).max, 1);
});

// ------------------------------------------------------------------ PN-11

test("PN-11: the limit of summaries - 400 finished sessions with one task: 300 items in 'История', exactly as many summaries as sessions among the shown items, none for a session without a shown item, 'показано 300 из 400'; the cases of the criterion: 301 tasks of one session, a resumed task A -> B", async () => {
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
  for (const c of cards)
    assert.ok(sessionsOfItems.has(c.byClass("session-id")[0].textContent));
  assert.equal(
    page.el("tasks").byClass("tasks-note")[0].textContent,
    "показано 300 из 400",
  );
  // 400 sessions with one task each are 400 tasks: the first shown are the newest
  assert.equal(page.items()[0].dataset.key, "t399");
  // 301 tasks of one finished session: 300 items, M = 301
  const k = journal();
  for (let i = 0; i < 301; i++) {
    launch(k, "big-session", `x${i}`, "Explore");
    k.subStop("big-session", `x${i}`, "Explore");
  }
  k.sessionEnd("big-session");
  const big = await loaded(k.entries);
  assert.equal(big.items().length, 300);
  const card = cardsOf(big).map(statsOf)[0];
  assert.equal(card.stats, "задач 301/301 · ролей 1");
  assert.equal(card.max, 301);
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
  const cardsR = cardsOf(await loaded(r.entries)).map(statsOf);
  const ca = cardsR.find((c) => c.id === "A-sessio");
  const cb = cardsR.find((c) => c.id === "B-sessio");
  assert.equal(ca.stats, "задач 0/0 · ролей 0");
  assert.deepEqual([cb.value, cb.max, cb.stats], [1, 1, "задач 1/1 · ролей 1"]);
  assert.equal(m.tasks.length, 1);
});

// ------------------------------------------------------------------ PN-12

test("PN-12: before the first load and after a failed one - the task body is empty, 'Сейчас' is hidden, the legend is empty, the office is the fixed layer with an empty bay 0 and no characters", async () => {
  for (const mode of ["hang", "fail"]) {
    const page = makePage({ entries: [] });
    page.server.mode = mode;
    await page.start();
    if (mode === "hang") await page.tick(3000);
    assert.equal(page.el("tasks").children.length, 0, mode);
    assert.equal(page.el("now").hidden, true);
    assert.equal(page.legend().length, 0);
    assert.deepEqual(page.app.getOffice().layout, buildLayout(0));
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
  page.canvas.rect = {
    left: 0,
    top: 0,
    width: page.canvas.width,
    height: page.canvas.height,
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
