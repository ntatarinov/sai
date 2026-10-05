// PG: the page, the reading rule and the tasks (design 10.2; REQ-001
// criteria 3-8 and 15; REQ-007 criterion 6). The page runs on fakes: a DOM
// parsed from index.html, a fake server, a manual clock and manual frames.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { buildModel, readRule } from "../src/pixel-office/public/model.js";
import {
  isCanonicalTime,
  parseLine,
  truncateDescription,
} from "../src/pixel-office/public/schema.js";
import {
  EMPTY_HINT,
  EMPTY_JOURNAL,
  HEADER_BADGE,
  LIVE,
  MAIN_ROW,
  NO_CONNECTION,
  NOT_FROM_HOOKS,
  ROLE_UNKNOWN,
  SHOWN_NOTE,
} from "../src/pixel-office/public/texts.js";
import { fmtTime, fmtDateTime } from "../src/pixel-office/public/format.js";
import {
  HELPERS_URL,
  NOW,
  PUBLIC,
  T0,
  at,
  entryOf,
  journal,
  makePage,
  rng,
  runWithTz,
  sandbox,
  withText,
} from "./pixel-office-helpers.js";
import { buildHistory } from "../src/pixel-office/public/history.js";
import { fmtTimeSec } from "../src/pixel-office/public/format.js";
import { buildOffice } from "../src/pixel-office/public/office-model.js";
import * as TX from "../src/pixel-office/public/texts.js";
import {
  HISTORY_NOTE_TEXT,
  HISTORY_TEXT,
  historyButtons,
  historyDom,
  historyFixture,
  historyRowOf,
  historyRows,
  noteEntry,
} from "./pixel-office-helpers.js";

const IMG = "<img src=x onerror=alert(1)>";

const model = (entries, starts = [], now = NOW) =>
  buildModel(entries, starts, now);

async function loaded(entries, starts = [], o = {}) {
  const page = makePage({ entries: [...entries], starts, ...o });
  await page.start();
  return page;
}

const startAt = (lines, sec = 0) => ({ time: at(sec), journal_lines: lines });

// ------------------------------------------------------ reading rule, 4.1

test("PG-01: the badge 'REAL - события хуков Claude Code' is in the header in all three states of the link block", async () => {
  const page = makePage({ entries: [] });
  page.server.mode = "hang";
  await page.start();
  assert.equal(page.el("link").dataset.state, "none");
  assert.equal(page.text("source-badge"), HEADER_BADGE);
  page.server.mode = "ok";
  await page.tick(3000);
  await page.tick(2000);
  assert.equal(page.el("link").dataset.state, "live");
  assert.equal(page.text("source-badge"), HEADER_BADGE);
  page.server.mode = "fail";
  await page.tick(2000);
  assert.equal(page.el("link").dataset.state, "down");
  assert.equal(page.text("source-badge"), HEADER_BADGE);
  assert.equal(HEADER_BADGE, "REAL — события хуков Claude Code");
});

function acceptedLog(n, seed) {
  const rand = rng(seed);
  const entries = [];
  for (let i = 0; i < n; i++) {
    const arrival = T0 + i * 1000;
    const off = Math.round((rand() * 118 - 59) * 1000);
    entries.push(
      entryOf(
        "UserPromptSubmit",
        `s${i % 5}`,
        new Date(arrival + off).toISOString(),
      ),
    );
  }
  return entries;
}

test("PG-02: a journal of accepted lines only (each within 59 s of its arrival) has no marks", () => {
  const entries = acceptedLog(500, 11);
  const marks = readRule(entries, T0 + 500 * 1000);
  assert.deepEqual(marks, new Array(500).fill(null));
});

test("PG-03: a SIMULATION line is the only one marked; the journal shows its source and 'не из хуков'", async () => {
  const j = journal();
  j.sessionStart("S1");
  j.raw({ ...entryOf("UserPromptSubmit", "S1", at(5)), source: "SIMULATION" });
  j.prompt("S1");
  const marks = readRule(j.entries, NOW);
  assert.deepEqual(marks, [null, "source", null]);
  const page = await loaded(j.entries);
  const marked = page.rows().filter((r) => r.dataset.marked === "true");
  assert.equal(marked.length, 1);
  assert.equal(marked[0].byClass("source")[0].textContent, "SIMULATION");
  assert.equal(marked[0].byClass("mark")[0].textContent, NOT_FROM_HOOKS);
});

test("PG-04: a REAL line written 10 minutes earlier after real lines is the only one marked, also behind just two real lines", () => {
  const mk = (n) => {
    const j = journal();
    for (let i = 0; i < n; i++) j.time(i * 10).prompt(`s${i}`);
    return j;
  };
  const j = mk(30);
  j.raw(entryOf("Stop", "x", at(30 * 10 - 600)));
  assert.deepEqual(
    readRule(j.entries, T0 + 400_000)
      .map((m, i) => (m ? i : -1))
      .filter((i) => i >= 0),
    [30],
  );
  // behind just two real lines 10 minutes apart
  const two = journal();
  two.raw(entryOf("Stop", "a", at(0)));
  two.raw(entryOf("Stop", "b", at(600)));
  two.raw(entryOf("Stop", "c", at(0)));
  assert.deepEqual(readRule(two.entries, T0 + 700_000), [
    null,
    null,
    "conflict",
  ]);
});

test("PG-05: a line an hour ahead followed by an hour of real lines is the only one marked", () => {
  const entries = [entryOf("Stop", "x", at(3600))];
  for (let i = 0; i < 60; i++) {
    entries.push(entryOf("Stop", `s${i}`, at(60 * i)));
  }
  const marks = readRule(entries, T0 + 3600_000);
  assert.equal(marks[0], "conflict");
  assert.equal(marks.filter((m) => m !== null).length, 1);
});

test("PG-06: the same journal read at T and at T + 2 hours gives the same marks when the last line is real and near", () => {
  const entries = acceptedLog(100, 3);
  const a = readRule(entries, T0 + 100_000);
  const b = readRule(entries, T0 + 100_000 + 2 * 3600_000);
  assert.deepEqual(a, b);
});

test("PG-07: a last line an hour ahead is 'future' when read earlier than its time and unmarked when read later", () => {
  const entries = acceptedLog(20, 5);
  entries.push(entryOf("Stop", "late", at(20 + 3600)));
  const early = readRule(entries, T0 + 30_000);
  assert.equal(early[entries.length - 1], "future");
  const later = readRule(entries, T0 + 3600_000 + 30_000);
  assert.equal(later[entries.length - 1], null);
});

test("PG-08: 100 000 accepted lines - the rule and the list of tasks together in at most 1000 ms; five written-in lines give exactly five marks", () => {
  const rand = rng(77);
  const entries = [];
  const kinds = ["UserPromptSubmit", "SubagentStart", "SubagentStop", "Stop"];
  for (let i = 0; i < 100_000; i++) {
    const arrival = T0 + i * 1000;
    const time = new Date(
      arrival + Math.round((rand() * 118 - 59) * 1000),
    ).toISOString();
    const kind = kinds[i % 4];
    const extra = kind.startsWith("Subagent")
      ? { agent_id: `a${i >> 2}`, agent_type: "r" }
      : {};
    entries.push(entryOf(kind, `s${(i >> 4) % 7}`, time, extra));
  }
  // the best of three runs: a loaded machine slows one run, not all
  const timed = (list, now) => {
    let best = Infinity;
    let m;
    for (let i = 0; i < 3; i++) {
      const t0 = performance.now();
      m = buildModel(list, [], now);
      best = Math.min(best, performance.now() - t0);
    }
    assert.ok(m.list.length > 0);
    return { ms: best, m };
  };
  const clean = timed(entries, T0 + 100_000_000);
  assert.ok(clean.ms <= 1000, `rule + tasks took ${clean.ms} ms`);
  assert.equal(clean.m.marks.filter((x) => x !== null).length, 0);
  const injected = [20_000, 35_000, 50_000, 65_000, 80_000];
  const dirty = entries.slice();
  injected.forEach((at_, k) => {
    const shift = (k % 2 === 0 ? 1 : -1) * 3600_000;
    dirty[at_] = entryOf(
      "Stop",
      `s${k}`,
      new Date(T0 + at_ * 1000 + shift).toISOString(),
    );
  });
  const bad = timed(dirty, T0 + 100_000_000);
  assert.ok(bad.ms <= 1000, `rule + tasks took ${bad.ms} ms`);
  const marked = bad.m.marks.map((x, i) => (x ? i : -1)).filter((i) => i >= 0);
  assert.deepEqual(marked, injected);
});

// The literal definition of rule (b), written out in the test.
function literalMarks(entries) {
  const t = entries.map((e) => (e === null ? NaN : Date.parse(e.time)));
  const marks = entries.map((e) => (e.source !== "REAL" ? "source" : null));
  for (;;) {
    const live = entries.map((_e, i) => i).filter((i) => marks[i] === null);
    const degree = new Map(live.map((i) => [i, 0]));
    for (const a of live) {
      for (const b of live) {
        if (a < b && t[b] < t[a] - 120_000) {
          degree.set(a, degree.get(a) + 1);
          degree.set(b, degree.get(b) + 1);
        }
      }
    }
    let best = -1;
    for (const i of live) {
      if (degree.get(i) === 0) continue;
      if (
        best === -1 ||
        degree.get(i) > degree.get(best) ||
        (degree.get(i) === degree.get(best) && i > best)
      ) {
        best = i;
      }
    }
    if (best === -1) return marks;
    marks[best] = "conflict";
  }
}

test("PG-09: the fast rule equals the literal definition on 300+ random logs; the k/m table", () => {
  const rand = rng(2026);
  for (let n = 0; n < 320; n++) {
    const size = 3 + Math.floor(rand() * 14);
    const entries = [];
    for (let i = 0; i < size; i++) {
      // few distinct levels: many equalities of degrees
      const level = Math.floor(rand() * 5) * 130 - 130 * Math.floor(rand() * 2);
      const e = entryOf("Stop", `s${i}`, at(level + (rand() < 0.2 ? 0 : 3)));
      if (rand() < 0.1) e.source = "SIMULATION";
      entries.push(e);
    }
    const fast = readRule(entries, Infinity).map((m) =>
      m === "source" ? "source" : m,
    );
    assert.deepEqual(fast, literalMarks(entries), `log ${n}`);
  }
  // k written-in lines (an hour ahead) and m real lines after them
  for (const [k, m, who] of [
    [1, 1, "real"],
    [2, 2, "real"],
    [3, 3, "real"],
    [1, 2, "written-in"],
    [2, 3, "written-in"],
    [3, 4, "written-in"],
  ]) {
    const entries = [];
    for (let i = 0; i < k; i++)
      entries.push(entryOf("Stop", `w${i}`, at(3600)));
    for (let i = 0; i < m; i++) entries.push(entryOf("Stop", `r${i}`, at(i)));
    const now = T0 + 3600_000;
    const marks = readRule(entries, now);
    const marked = marks.map((x, i) => (x ? i : -1)).filter((i) => i >= 0);
    const expected =
      who === "real"
        ? Array.from({ length: m }, (_x, i) => k + i)
        : Array.from({ length: k }, (_x, i) => i);
    assert.deepEqual(marked, expected, `k=${k} m=${m}`);
    // without new lines the marks are permanent
    assert.deepEqual(readRule(entries, now + 7200_000), marks);
  }
});

test("PG-10: a marked line is not used: SubagentStart makes no task, SessionEnd closes none, UserPromptSubmit makes no row", () => {
  const sim = (kind, extra = {}) => ({
    ...entryOf(kind, "S1", at(10), extra),
    source: "SIMULATION",
  });
  const a = journal();
  a.raw(sim("SubagentStart", { agent_id: "x", agent_type: "r" }));
  assert.equal(model(a.entries).tasks.length, 0);
  const b = journal();
  b.subStart("S1", "x", "r");
  b.raw(sim("SessionEnd"));
  assert.equal(model(b.entries).tasks[0].state, "in_progress");
  const c = journal();
  c.raw(sim("UserPromptSubmit"));
  assert.equal(model(c.entries).mainRows.length, 0);
});

// ------------------------------------------------- one stream of events

test("PG-11: one sequence gives a journal and a task list that agree; one more event changes both consistently", async () => {
  const j = journal();
  j.sessionStart("S1");
  j.prompt("S1");
  j.subStart("S1", "a1", "Explore");
  const page = await loaded(j.entries);
  assert.equal(page.rows().length, 3);
  assert.equal(page.items().length, 2);
  const m1 = page.app.getModel();
  assert.equal(m1.journal.length, m1.entries.length);
  j.subStop("S1", "a1", "Explore");
  await page.push(j.entries[3]);
  assert.equal(page.rows().length, 4);
  assert.equal(page.items().length, 2);
  const states = page.items().map((e) => e.dataset.state);
  assert.deepEqual(states.sort(), ["completed", "in_progress"]);
});

// -------------------------------------------------------------- 4.2 tasks

test("PG-12a: a repeated start of the same agent_id is one task, in progress again, with resumed_at", () => {
  const j = journal();
  j.subStart("S1", "a1", "r");
  j.subStop("S1", "a1", "r");
  j.subStart("S1", "a1", "r");
  const m = model(j.entries);
  assert.equal(m.tasks.length, 1);
  assert.equal(m.tasks[0].state, "in_progress");
  assert.equal(m.tasks[0].resumed_at, j.entries[2].time);
});

test("PG-12b: an end without a start makes no task; the line is in the journal", () => {
  const j = journal();
  j.subStop("S1", "ghost", "r");
  const m = model(j.entries);
  assert.equal(m.tasks.length, 0);
  assert.equal(m.journal.length, 1);
});

test("PG-12c1: a server start after the start of a task makes it 'окончание не записано'", () => {
  const j = journal();
  j.subStart("S1", "a1", "r");
  assert.equal(model(j.entries, [startAt(1)]).tasks[0].state, "unrecorded");
  assert.equal(model(j.entries, [startAt(0)]).tasks[0].state, "in_progress");
});

test("PG-12c2: SessionEnd after the start makes it 'окончание не записано'", () => {
  const j = journal();
  j.subStart("S1", "a1", "r");
  j.sessionEnd("S1");
  assert.equal(model(j.entries).tasks[0].state, "unrecorded");
});

test("PG-12c3: SessionEnd, SessionStart with the same session_id, a start - the task is in progress", () => {
  const j = journal();
  j.sessionEnd("S1");
  j.sessionStart("S1");
  j.subStart("S1", "a1", "r");
  assert.equal(model(j.entries).tasks[0].state, "in_progress");
});

test("PG-12c4: the time of every server start is shown on the page", async () => {
  const j = journal();
  j.subStart("S1", "a1", "r");
  const starts = [startAt(0, -500), startAt(0, 5), startAt(99, 9)];
  const page = await loaded(j.entries, starts);
  const items = page
    .el("tasks")
    .byClass("starts")[0]
    .children.map((li) => li.textContent);
  assert.equal(items.length, 3);
  assert.deepEqual(
    items,
    [...starts].reverse().map((s) => fmtDateTime(s.time)),
  );
});

test("PG-12c5: next to 'в работе' the page shows the start time and the time of the last event of the session", async () => {
  const j = journal();
  j.sessionStart("S1");
  j.subStart("S1", "a1", "r");
  j.prompt("S1");
  const page = await loaded(j.entries);
  const item = page.items().find((e) => e.dataset.kind === "task");
  assert.equal(item.dataset.state, "in_progress");
  const started = item.byClass("started")[0];
  const last = item.byClass("last-event")[0];
  assert.equal(started.textContent, fmtTime(j.entries[1].time));
  assert.equal(last.textContent, fmtTime(j.entries[2].time));
});

test("PG-12c6: an end that came after the server start returns the task to 'завершена'", () => {
  const j = journal();
  j.subStart("S1", "a1", "r");
  const starts = [startAt(1)];
  assert.equal(model(j.entries, starts).tasks[0].state, "unrecorded");
  j.subStop("S1", "a1", "r");
  assert.equal(model(j.entries, starts).tasks[0].state, "completed");
});

test("PG-12c7: a start record with journal_lines above the number of lines is ignored", () => {
  const j = journal();
  j.sessionStart("S1");
  j.subStart("S1", "a1", "r");
  const m = model(j.entries, [startAt(50)]);
  assert.equal(m.tasks[0].state, "in_progress");
  const j2 = journal();
  j2.prompt("S1");
  assert.equal(
    model(j2.entries, [startAt(50)]).mainRows[0].state,
    "in_progress",
  );
});

test("PG-12c8: a task resumed in another session belongs to it; the end of the old session does not close it, the end of the new one does", () => {
  const j = journal();
  j.subStart("A", "x", "r");
  j.subStart("B", "x", "r");
  assert.equal(model(j.entries).tasks.length, 1);
  assert.equal(model(j.entries).tasks[0].session_id, "B");
  j.sessionEnd("A");
  assert.equal(model(j.entries).tasks[0].state, "in_progress");
  j.sessionEnd("B");
  assert.equal(model(j.entries).tasks[0].state, "unrecorded");
});

test("PG-12d1: a main-session row closed by Stop", () => {
  const j = journal();
  j.prompt("S1");
  j.stop("S1");
  const r = model(j.entries).mainRows;
  assert.equal(r.length, 1);
  assert.equal(r[0].state, "completed");
  assert.equal(r[0].closed_by, "stop");
});

test("PG-12d2: closed by the next request as 'окончание не записано'", () => {
  const j = journal();
  j.prompt("S1");
  j.prompt("S1");
  const r = model(j.entries).mainRows;
  assert.equal(r[0].state, "unrecorded");
  assert.equal(r[0].closed_by, "next_prompt");
  assert.equal(r[1].state, "in_progress");
});

test("PG-12d3: closed by SessionEnd", () => {
  const j = journal();
  j.prompt("S1");
  j.sessionEnd("S1");
  const r = model(j.entries).mainRows[0];
  assert.equal(r.state, "unrecorded");
  assert.equal(r.closed_by, "session_end");
});

test("PG-12d4: Stop without an open row changes nothing and makes no row", () => {
  const j = journal();
  j.stop("S1");
  const m = model(j.entries);
  assert.equal(m.mainRows.length, 0);
  assert.equal(m.list.length, 0);
});

test("PG-12d5: the text of a request is nowhere in the row", () => {
  // REQ-008 design 12.1: the journal line now carries the stored text of the
  // owner message; the row of the main session gets only prompt_kind.
  const unique = "pg12d5-unique-request-text-7f3a";
  const j = journal();
  j.prompt("S1", { prompt_kind: "owner", prompt_text: unique });
  const row = model(j.entries).mainRows[0];
  assert.deepEqual(Object.keys(row).sort(), [
    "closed_by",
    "end_index",
    "ended_at",
    "key",
    "kind",
    "prompt_kind",
    "session_id",
    "start_index",
    "started_at",
    "state",
  ]);
  assert.equal(row.prompt_kind, "owner");
  assert.ok(!Object.hasOwn(row, "prompt_text"));
  assert.ok(!JSON.stringify(row).includes(unique));
  assert.equal(MAIN_ROW, "Основная сессия — обрабатывает запрос");
});

function main1(entries, starts = []) {
  return model(entries, starts).mainRows;
}

test("PG-12d6 (1): request, server start after it, then Stop of the same session - 'окончание не записано', then 'завершена' (the named scenario)", () => {
  const j = journal();
  j.prompt("S1");
  let rows = main1(j.entries, [startAt(1)]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].state, "unrecorded");
  assert.equal(rows[0].closed_by, "server_start");
  assert.equal(rows[0].ended_at, null);
  const stop = j.stop("S1");
  rows = main1(j.entries, [startAt(1)]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].state, "completed");
  assert.equal(rows[0].closed_by, "stop");
  assert.equal(rows[0].ended_at, j.entries[stop].time);
  assert.equal(rows[0].end_index, stop);
});

test("PG-12d6 (2): a server start BEFORE the request leaves the row 'обрабатывает запрос' - also with two records and when the hook time is 30 s earlier", () => {
  const j = journal();
  j.sessionStart("S1");
  j.prompt("S1");
  assert.equal(
    main1(j.entries, [startAt(0), startAt(1)])[0].state,
    "in_progress",
  );
  const starts = [{ time: at(32), journal_lines: 1 }];
  assert.equal(main1(j.entries, starts)[0].state, "in_progress");
  assert.equal(main1(j.entries, starts).length, 1);
});

test("PG-12d6 (3): Stop of another session does not close the row, before or after a server start", () => {
  const j = journal();
  j.prompt("S1");
  j.stop("S2");
  let rows = main1(j.entries, [startAt(0)]);
  assert.equal(rows[0].state, "in_progress");
  rows = main1(j.entries, [startAt(2)]);
  assert.equal(rows[0].state, "unrecorded");
  assert.equal(rows[0].closed_by, "server_start");
  assert.equal(rows[0].end_index, null);
});

test("PG-12d6 (4): request, server start, the next request, Stop - the first row is closed by the next request, the second is complete", () => {
  const j = journal();
  j.prompt("S1");
  j.prompt("S1");
  j.stop("S1");
  const rows = main1(j.entries, [startAt(1)]);
  assert.equal(rows[0].state, "unrecorded");
  assert.equal(rows[0].closed_by, "next_prompt");
  assert.equal(rows[1].state, "completed");
  assert.equal(rows.length, 2);
});

test("PG-12d6 (5): request, SessionEnd, SessionStart (the same id), Stop - the row stays 'окончание не записано'", () => {
  const j = journal();
  j.prompt("S1");
  j.sessionEnd("S1");
  j.sessionStart("S1");
  j.stop("S1");
  const rows = main1(j.entries);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].state, "unrecorded");
  assert.equal(rows[0].closed_by, "session_end");
  assert.equal(rows[0].ended_at, null);
});

test("PG-12d6 (6): a second Stop changes nothing", () => {
  const j = journal();
  j.prompt("S1");
  const first = j.stop("S1");
  j.stop("S1");
  const rows = main1(j.entries);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].ended_at, j.entries[first].time);
  assert.equal(rows[0].end_index, first);
});

test("PG-12d6 (7): a Stop marked 'не из хуков' does not close the row; a marked request makes no row and closes nothing", () => {
  const j = journal();
  j.prompt("S1");
  j.raw({ ...entryOf("Stop", "S1", at(5)), source: "SIMULATION" });
  assert.equal(main1(j.entries)[0].state, "in_progress");
  j.raw({ ...entryOf("UserPromptSubmit", "S1", at(6)), source: "SIMULATION" });
  const rows = main1(j.entries);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].state, "in_progress");
});

test("PG-12d6 (8): a stale start record (journal_lines above the number of lines) does not close the row", () => {
  const j = journal();
  j.prompt("S1");
  assert.equal(main1(j.entries, [startAt(10)])[0].state, "in_progress");
});

test("PG-12d6 (9a): a request of another session does not close the row - both are 'обрабатывает запрос'", () => {
  const j = journal();
  j.prompt("S1");
  j.prompt("S2");
  const rows = main1(j.entries);
  assert.deepEqual(
    rows.map((r) => r.state),
    ["in_progress", "in_progress"],
  );
});

test("PG-12d6 (9b): with a server start between the requests the first row is 'окончание не записано' by the server start, the second is in progress", () => {
  const j = journal();
  j.prompt("S1");
  j.prompt("S2");
  const rows = main1(j.entries, [startAt(1)]);
  assert.equal(rows[0].state, "unrecorded");
  assert.equal(rows[0].closed_by, "server_start");
  assert.equal(rows[1].state, "in_progress");
});

test("PG-12d6 (10): SessionEnd of another session does not close the row", () => {
  const j = journal();
  j.prompt("S1");
  j.sessionEnd("S2");
  assert.equal(main1(j.entries)[0].state, "in_progress");
});

test("PG-12d6 (11): SessionEnd before the request does not close the row", () => {
  const j = journal();
  j.sessionEnd("S1");
  j.sessionStart("S1");
  j.prompt("S1");
  assert.equal(main1(j.entries)[0].state, "in_progress");
});

test("PG-12d7: MainRow.key is main:<start_index>, unique and stable between recalculations and loads; the page puts it into data-key", async () => {
  const j = journal();
  j.prompt("S1");
  j.stop("S1");
  j.prompt("S2");
  const a = model(j.entries).mainRows.map((r) => r.key);
  const b = model(j.entries, [], NOW + 99999).mainRows.map((r) => r.key);
  assert.deepEqual(a, ["main:0", "main:2"]);
  assert.deepEqual(a, b);
  assert.equal(new Set(a).size, a.length);
  const page = await loaded(j.entries);
  const keys = page
    .items()
    .map((e) => e.dataset.key)
    .sort();
  assert.deepEqual(keys, ["main:0", "main:2"]);
});

test("PG-12e: 'в работе' first, then the rest, new ones on top", () => {
  const j = journal();
  j.subStart("S1", "a1", "r");
  j.subStop("S1", "a1", "r");
  j.subStart("S1", "a2", "r");
  j.subStart("S1", "a3", "r");
  j.subStop("S1", "a3", "r");
  j.subStart("S1", "a4", "r");
  const keys = model(j.entries).list.map((i) => i.key);
  assert.deepEqual(keys, ["a4", "a2", "a3", "a1"]);
});

test("PG-12f: under TZ=Asia/Almaty 2026-09-20T04:00:00Z is shown as 09:00 with the zone Asia/Almaty", (t) => {
  const out = runWithTz(
    sandbox(t),
    "Asia/Almaty",
    `import { fmtTime, tzLabel } from ${JSON.stringify(
      new URL("../src/pixel-office/public/format.js", HELPERS_URL).href,
    )};
     console.log(JSON.stringify([fmtTime("2026-09-20T04:00:00Z"), tzLabel()]));`,
  );
  assert.deepEqual(JSON.parse(out), ["09:00", "Asia/Almaty"]);
});

test("PG-12g: an empty journal shows 'Событий от хуков пока нет' and the hint, word for word", async () => {
  const page = await loaded([]);
  const note = page.el("journal").byClass("journal-empty")[0];
  assert.equal(note.dataset.reason, "empty");
  assert.equal(
    note.byClass("empty-title")[0].textContent,
    "Событий от хуков пока нет",
  );
  const hint = note.byClass("empty-hint")[0].textContent;
  const expected =
    "Видны только сессии Claude Code, в настройках которых есть обработчики Pixel Office: запущенные в папке sai/, а сессии другой папки — только если в её настройках проекта есть копия обработчиков.";
  assert.equal(hint, expected);
  assert.equal(hint.includes("запущенные в каталоге sai/"), false);
  assert.equal(EMPTY_HINT, expected);
  assert.equal(EMPTY_JOURNAL, "Событий от хуков пока нет");
});

test("PG-12h: the description is shown only when identifiers link it; never a guessed one", () => {
  // two calls of one role with different descriptions and two starts
  const linked = journal();
  linked.post("S", "tu1", "a1", { subagentType: "r", description: "first" });
  linked.post("S", "tu2", "a2", { subagentType: "r", description: "second" });
  linked.subStart("S", "a1", "r");
  linked.subStart("S", "a2", "r");
  const m = model(linked.entries);
  const byKey = new Map(m.tasks.map((t) => [t.key, t.description]));
  assert.equal(byKey.get("a1"), "first");
  assert.equal(byKey.get("a2"), "second");
  // without the linking lines neither has a description
  const bare = journal();
  bare.subStart("S", "a1", "r");
  bare.subStart("S", "a2", "r");
  assert.deepEqual(
    model(bare.entries).tasks.map((t) => t.description),
    [null, null],
  );
  // a duplicate tool_use_id collapses into one
  const dup = journal();
  dup.post("S", "tu1", "a1", { description: "once" });
  dup.post("S", "tu1", "a1", { description: "once" });
  dup.subStart("S", "a1", "r");
  assert.equal(model(dup.entries).tasks[0].description, "once");
  // two different linking lines for one agentId: no description
  const two = journal();
  two.post("S", "tu1", "a1", { description: "one" });
  two.post("S", "tu2", "a1", { description: "two" });
  two.subStart("S", "a1", "r");
  assert.equal(model(two.entries).tasks[0].description, null);
  // the order of PostToolUse and SubagentStart does not matter
  const before = journal();
  before.post("S", "tu1", "a1", { description: "d" });
  before.subStart("S", "a1", "r");
  const after = journal();
  after.subStart("S", "a1", "r");
  after.post("S", "tu1", "a1", { description: "d" });
  assert.equal(model(before.entries).tasks[0].description, "d");
  assert.equal(model(after.entries).tasks[0].description, "d");
});

// --------------------------------------------------------------- polling

test("PG-13: an event that appears right after a poll is on the page within 5 s, without reloading", async () => {
  const j = journal();
  j.sessionStart("S1");
  const page = await loaded(j.entries);
  assert.equal(page.rows().length, 1);
  j.prompt("S1");
  page.server.entries.push(j.entries[1]);
  let waited = 0;
  while (page.rows().length < 2 && waited < 6000) {
    await page.tick(1000);
    waited += 1000;
  }
  assert.equal(page.rows().length, 2);
  assert.ok(waited <= 5000, `visible after ${waited} ms`);
});

test("PG-14: a refusing fetch gives 'down' and 'Нет связи с сервером Pixel Office'; the loaded data stays; after recovery the missed events are loaded without duplicates", async () => {
  const j = journal();
  j.sessionStart("S1");
  j.prompt("S1");
  const page = await loaded(j.entries);
  const entries = page.app.getModel().entries;
  const modelBefore = page.app.getModel();
  page.server.mode = "fail";
  await page.tick(2000);
  assert.equal(page.el("link").dataset.state, "down");
  assert.equal(page.text("link-status"), NO_CONNECTION);
  assert.equal(page.app.getModel().entries, entries);
  assert.equal(entries.length, 2);
  assert.equal(page.app.getModel(), modelBefore);
  const calls = page.server.calls.length;
  await page.tick(2000);
  assert.ok(page.server.calls.length > calls, "the polling goes on");
  j.stop("S1");
  page.server.entries.push(j.entries[2]);
  page.server.mode = "ok";
  await page.tick(2000);
  assert.equal(page.el("link").dataset.state, "live");
  assert.equal(page.text("link-status"), LIVE);
  assert.equal(page.app.getModel().entries.length, 3);
  assert.equal(page.rows().length, 3);
});

test("PG-14b: a request that never ends is cut off after 3 s with 'Нет связи'; while it is in flight there are no new requests; the polling resumes after the cut-off", async () => {
  const j = journal();
  j.sessionStart("S1");
  const page = await loaded(j.entries);
  page.server.mode = "hang";
  const base = page.server.calls.length;
  await page.tick(2000);
  assert.equal(page.server.calls.length, base + 1);
  for (let i = 0; i < 3; i++) {
    page.clock.fire();
    await page.tick(0);
  }
  assert.equal(
    page.server.calls.length,
    base + 1,
    "three more ticks: no request",
  );
  assert.notEqual(page.text("link-status"), NO_CONNECTION);
  await page.tick(2000);
  assert.equal(page.server.calls.length, base + 1);
  await page.tick(1000);
  assert.equal(page.text("link-status"), NO_CONNECTION);
  assert.equal(page.server.calls[base].init.signal.aborted, true);
  page.server.mode = "ok";
  const j2 = journal();
  j2.time(50).prompt("S1");
  page.server.entries.push(j2.entries[0]);
  await page.tick(1000);
  assert.ok(page.server.calls.length > base + 1, "the polling resumed");
  await page.tick(2000);
  assert.equal(page.text("link-status"), LIVE);
  assert.equal(page.rows().length, 2);
});

test("PG-14c: an answer whose from is neither 0 nor entries.length is dropped; one request with after = entries.length follows at once; a second misfit in a row is 'Нет связи'; from = 0 replaces the array", async () => {
  const j = journal();
  j.sessionStart("S1");
  j.prompt("S1");
  j.stop("S1");
  for (const badFrom of [1, 2, 5]) {
    const page = await loaded(j.entries);
    const entries = page.app.getModel().entries;
    const snapshot = JSON.stringify(entries);
    const calls = page.server.calls.length;
    let n = 0;
    page.server.respond = (after) => {
      n += 1;
      if (n === 1) {
        // a stale answer; its `lines` differs from entries.length
        return {
          app: "sai-pixel-office",
          lines: 4,
          from: badFrom,
          events: j.entries.slice(0, 2),
          server_starts: [],
        };
      }
      return {
        app: "sai-pixel-office",
        lines: 3,
        from: after === 3 ? 3 : 0,
        events: after === 3 ? [] : j.entries,
        server_starts: [],
      };
    };
    await page.tick(2000);
    assert.equal(
      JSON.stringify(entries),
      snapshot,
      `from ${badFrom}: array unchanged`,
    );
    assert.equal(
      page.server.calls.length,
      calls + 2,
      "one more request at once",
    );
    assert.match(page.server.calls[calls + 1].url, /after=3$/);
    assert.equal(page.app.getModel().entries.length, 3);
  }
  // two in a row
  const page = await loaded(j.entries);
  page.server.respond = () => ({
    app: "sai-pixel-office",
    lines: 4,
    from: 1,
    events: [],
    server_starts: [],
  });
  const calls = page.server.calls.length;
  await page.tick(2000);
  assert.equal(page.server.calls.length, calls + 2);
  assert.equal(page.text("link-status"), NO_CONNECTION);
  assert.equal(page.app.getModel().entries.length, 3);
  // from = 0 replaces the array
  page.server.respond = () => ({
    app: "sai-pixel-office",
    lines: 1,
    from: 0,
    events: [j.entries[0]],
    server_starts: [],
  });
  await page.tick(2000);
  assert.equal(page.app.getModel().entries.length, 1);
  assert.equal(page.text("link-status"), LIVE);
});

test("PG-14d: a visible tab polls at once, not waiting for the tick; one request in flight means no second; hidden does not force a poll", async () => {
  const j = journal();
  j.sessionStart("S1");
  const page = await loaded(j.entries);
  const base = page.server.calls.length;
  page.doc.visibilityState = "hidden";
  page.doc.fire("visibilitychange");
  await page.tick(0);
  assert.equal(page.server.calls.length, base, "hidden: no poll");
  page.doc.visibilityState = "visible";
  page.doc.fire("visibilitychange");
  await page.tick(0);
  assert.equal(page.server.calls.length, base + 1, "visible: at once");
  page.server.mode = "hang";
  page.doc.fire("visibilitychange");
  await page.tick(0);
  assert.equal(page.server.calls.length, base + 2);
  page.doc.fire("visibilitychange");
  page.doc.fire("visibilitychange");
  await page.tick(0);
  assert.equal(page.server.calls.length, base + 2, "in flight: no second");
});

test("PG-15: over a whole session every fetch is a GET with a relative address", async () => {
  const j = journal();
  j.sessionStart("S1");
  j.subStart("S1", "a1", "Explore");
  const page = await loaded(j.entries);
  page.server.mode = "fail";
  await page.tick(2000);
  page.server.mode = "ok";
  await page.tick(2000);
  page.legend()[0].click();
  page.app.setFilter("work");
  page.app.setPaused(true);
  assert.ok(page.server.calls.length >= 3);
  for (const c of page.server.calls) {
    assert.equal(c.method, "GET");
    assert.equal(c.init.method, "GET");
    assert.match(c.url, /^\/api\/events\?after=\d+$/);
  }
});

test("PG-16: description, agent_type and session_id equal to an <img onerror> are text, never an element", async () => {
  const j = journal();
  j.sessionStart(IMG);
  j.post(IMG, "tu1", "a1", { subagentType: IMG, description: IMG });
  j.subStart(IMG, "a1", IMG);
  j.subStart("S9", "a2", IMG);
  const page = await loaded(j.entries);
  assert.equal(page.created("img").length, 0);
  assert.ok(withText(page.el("journal"), IMG).length >= 1);
  assert.ok(withText(page.el("tasks"), IMG).length >= 1);
  const shortId = Array.from(IMG).slice(0, 8).join("");
  assert.ok(withText(page.el("journal"), shortId).length >= 1);
  assert.equal(page.doc.htmlWrites, 0);
});

test("PG-17: every address of fetch begins with /", async () => {
  const page = await loaded([entryOf("Stop", "S1", at(1))]);
  await page.tick(2000);
  page.server.mode = "fail";
  await page.tick(2000);
  for (const c of page.server.calls) {
    assert.equal(c.url.startsWith("/"), true);
    assert.equal(c.url.startsWith("//"), false);
    assert.equal(/^[a-z]+:/i.test(c.url), false);
  }
});

test("PG-18: limits at 100 000 lines - the journal shows the last 200 (new ones at the bottom) and '200 из 100000'; the panel shows 300 items with the note; the rules read everything", async () => {
  const n = 100_000;
  const entries = [];
  for (let i = 0; i < n / 4; i++) {
    const base = T0 + i * 4000;
    const s = `s${i % 9}`;
    entries.push(entryOf("UserPromptSubmit", s, new Date(base).toISOString()));
    entries.push(
      entryOf("SubagentStart", s, new Date(base + 1000).toISOString(), {
        agent_id: `a${i}`,
        agent_type: "r",
      }),
    );
    entries.push(
      entryOf("SubagentStop", s, new Date(base + 2000).toISOString(), {
        agent_id: `a${i}`,
        agent_type: "r",
      }),
    );
    entries.push(entryOf("Stop", s, new Date(base + 3000).toISOString()));
  }
  const page = await loaded(entries, [], { now: T0 + n * 1000 });
  const rows = page.rows();
  assert.equal(rows.length, 200);
  assert.equal(rows[0].dataset.index, String(n - 200));
  assert.equal(rows[199].dataset.index, String(n - 1));
  assert.match(page.text("journal-meta"), /200 из 100000$/);
  assert.equal(page.items().length, 300);
  const total = page.app.getModel().list.length;
  assert.equal(total, n / 2);
  const note = page.el("tasks").byClass("tasks-note")[0];
  assert.equal(
    note.textContent,
    SHOWN_NOTE.replace("{n}", "300").replace("{N}", String(total)),
  );
  assert.equal(page.app.getModel().tasks.length, n / 4);
  assert.equal(page.app.getModel().entries.length, n);
});

test("PG-19: null elements, lines with foreign keys or an unknown kind are skipped, the rest is shown; skipped ones stay in entries as null; the next request has after = entries.length", async () => {
  const good1 = entryOf("SessionStart", "S1", at(1));
  const good2 = entryOf("Stop", "S1", at(2));
  const events = [
    good1,
    null,
    { ...good1, extra: 1 },
    { ...good1, hook_event_name: "Nope" },
    good2,
  ];
  const page = makePage({ entries: [] });
  page.server.respond = (after) => ({
    app: "sai-pixel-office",
    lines: 5,
    from: after === 5 ? 5 : 0,
    events: after === 5 ? [] : events,
    server_starts: [],
  });
  await page.start();
  const m = page.app.getModel();
  assert.equal(m.entries.length, 5);
  assert.deepEqual(
    m.entries.map((e) => e === null),
    [false, true, true, true, false],
  );
  assert.equal(page.rows().length, 2);
  await page.tick(2000);
  assert.match(page.server.calls[page.server.calls.length - 1].url, /after=5$/);
});

function stripComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

test("PG-20: analysis of the files of public/ - no dangerous calls, no storage, no randomness, no clock in pure modules, no Node in browser modules", () => {
  const files = fs.readdirSync(PUBLIC).filter((f) => /\.(js|html)$/.test(f));
  assert.ok(files.length >= 12);
  const pure = [
    "texts.js",
    "format.js",
    "model.js",
    "layout.js",
    "office-model.js",
    "office-sim.js",
    "panels.js",
    "office-view.js",
  ];
  const banned = [
    /innerHTML/,
    /outerHTML/,
    /insertAdjacentHTML/,
    /document\.write/,
    /\beval\(/,
    /new Function/,
    /setAttribute\(\s*["']style["']/,
    /\.style\b/,
    /cssText/,
    /\son[a-z]+=/i,
    /javascript:/i,
    /http:\/\//,
    /https:\/\//,
    /localStorage/,
    /sessionStorage/,
    /indexedDB/,
    /document\.cookie/,
    /Math\.random/,
  ];
  for (const f of files) {
    const text = fs.readFileSync(path.join(PUBLIC, f), "utf8");
    for (const re of banned) assert.equal(re.test(text), false, `${f}: ${re}`);
    if (f.endsWith(".css")) continue;
    if (pure.includes(f)) {
      assert.equal(/Date\.now|new Date/.test(text), false, `${f}: clock`);
    }
    if (f !== "office-report.js" && f.endsWith(".js")) {
      const code = stripComments(text);
      assert.equal(/from\s+["']node:/.test(code), false, `${f}: node import`);
      assert.equal(/\bprocess\b/.test(code), false, `${f}: process`);
      assert.equal(/\bBuffer\b/.test(code), false, `${f}: Buffer`);
      assert.equal(/\brequire\s*\(/.test(code), false, `${f}: require`);
      assert.equal(/office-report/.test(code), false, `${f}: office-report`);
    }
    for (const m of text.matchAll(
      /(?:from|import)\s*\(?\s*["'](\.[^"']+)["']/g,
    )) {
      assert.ok(fs.existsSync(path.join(PUBLIC, m[1])), `${f} imports ${m[1]}`);
    }
  }
  const css = fs.readFileSync(path.join(PUBLIC, "style.css"), "utf8");
  for (const re of [/https?:\/\//, /javascript:/i, /@import/, /url\(/]) {
    assert.equal(re.test(css), false, `style.css: ${re}`);
  }
  const html = fs.readFileSync(path.join(PUBLIC, "index.html"), "utf8");
  assert.equal(/office-report/.test(html), false);
  assert.equal(/<style\b/i.test(html), false);
  assert.equal(/\sstyle\s*=/i.test(html), false);
  for (const tag of html.match(/<script\b[^>]*>/gi) ?? []) {
    assert.match(tag, /\ssrc=/);
    assert.match(tag, /type="module"/);
  }
});

test("PG-21: App.getModel().entries is one array that the journal, the list, the office and the card are built from", async () => {
  const j = journal();
  j.sessionStart("S1");
  j.prompt("S1");
  j.subStart("S1", "a1", "Explore");
  const page = await loaded(j.entries);
  const ref = page.app.getModel().entries;
  const m = page.app.getModel();
  assert.equal(m.journal.length, ref.length);
  assert.equal(page.app.getOffice().characters.length, 2);
  j.subStop("S1", "a1", "Explore");
  await page.push(j.entries[3]);
  assert.equal(page.app.getModel().entries, ref, "the same array object");
  assert.equal(ref.length, 4);
  assert.equal(page.rows().length, 4);
  assert.equal(page.app.getModel().tasks[0].state, "completed");
  page.legend()[1].click();
  assert.equal(page.el("card-overlay").hidden, false);
});

test("PG-22: parseLine, isCanonicalTime and truncateDescription - limits and refusals; __proto__ and constructor are ordinary values", () => {
  const ok = entryOf("SubagentStart", "s", at(1), {
    agent_id: "a",
    agent_type: "r",
  });
  assert.ok(parseLine(ok) !== null);
  assert.equal(parseLine(null), null);
  assert.equal(parseLine([]), null);
  assert.equal(parseLine({ ...ok, extra: 1 }), null);
  assert.equal(parseLine({ ...ok, source: "" }), null);
  assert.equal(parseLine({ ...ok, session_id: "x".repeat(129) }), null);
  assert.ok(parseLine({ ...ok, session_id: "x".repeat(128) }) !== null);
  assert.equal(parseLine({ ...ok, time: "2026-09-20T10:00:00Z" }), null);
  // REQ-008 2.1: a hook event with source ORCH is corrupt; other foreign
  // sources are read as before; a record of the orchestrator (kind B) is a
  // line, and kind B with hook_event_name or with source REAL is not.
  assert.equal(parseLine({ ...ok, source: "ORCH" }), null);
  assert.ok(parseLine({ ...ok, source: "SIMULATION" }) !== null);
  const note = { time: at(2), source: "ORCH", note_text: "как понял" };
  assert.ok(parseLine(note) !== null);
  assert.equal(parseLine({ ...note, hook_event_name: "Stop" }), null);
  assert.equal(parseLine({ ...note, source: "REAL" }), null);
  assert.equal(isCanonicalTime("2026-09-20T10:00:00.000Z"), true);
  assert.equal(isCanonicalTime("2026-02-30T10:00:00.000Z"), false);
  assert.equal(isCanonicalTime("2026-09-20T10:00:00.000+05:00"), false);
  assert.equal(isCanonicalTime(5), false);
  assert.equal(truncateDescription("x".repeat(100)), "x".repeat(100));
  assert.equal(Array.from(truncateDescription("😀".repeat(150))).length, 100);
  assert.equal(truncateDescription(5), "");
  for (const word of ["__proto__", "constructor"]) {
    const raw = JSON.parse(
      `{"time":"${at(1)}","source":"REAL","hook_event_name":"SubagentStart","session_id":"${word}","agent_id":"${word}","agent_type":"${word}"}`,
    );
    const line = parseLine(raw);
    assert.ok(line !== null, word);
    const m = model([line]);
    assert.equal(m.tasks.length, 1);
    assert.equal(m.tasks[0].role, word);
    assert.equal({}.polluted, undefined);
    assert.equal(Object.getPrototypeOf(m.tasks[0].role), String.prototype);
  }
});

test("PG-23: role and description of the journal rows by kind; hostile values are text in span.who and span.row-desc; keys go to data-key", async () => {
  const j = journal();
  j.sessionStart("S1");
  j.prompt("S1");
  j.post("S1", "tu1", "a1", { subagentType: IMG, description: IMG });
  j.subStart("S1", "a1", IMG);
  j.subStop("S1", "a1", IMG);
  j.stop("S1");
  const m = model(j.entries);
  const by = (kind) => m.journal.find((r) => r.event === kind);
  assert.equal(by("PostToolUse").role, IMG);
  assert.equal(by("PostToolUse").description, IMG);
  assert.equal(by("SubagentStart").role, IMG);
  assert.equal(by("SessionStart").role, "");
  const page = await loaded(j.entries);
  const who = page
    .el("journal")
    .byClass("who")
    .map((e) => e.textContent);
  assert.ok(who.includes(IMG));
  assert.ok(who.includes("Основная сессия"));
  const descs = page
    .el("journal")
    .byClass("row-desc")
    .map((e) => e.textContent);
  assert.ok(descs.length >= 1);
  assert.ok(descs.every((d) => d === IMG));
  assert.equal(page.created("img").length, 0);
  const keys = page
    .items()
    .map((e) => e.dataset.key)
    .sort();
  assert.deepEqual(keys, ["a1", "main:1"]);
  assert.equal(ROLE_UNKNOWN, "(роль не указана)");
});

// ------------------------------------------------ REQ-008 part (b): PG-24..28

const hist = (entries) => buildHistory(model(entries));
const fillN = (text, n) => text.replace("{n}", String(n));
const mapOf = (items) => items.map((i) => [i.who, i.what]);

async function openWindow(page, key) {
  const row = historyRowOf(page, key);
  assert.ok(row !== null, `no row for ${key}`);
  row.click();
  const dom = historyDom(page);
  assert.equal(dom.isOpen(), true);
  return dom;
}

test("PG-24: a message without a stored text has text = null; the window shows HISTORY_TEXT_DISABLED instead of the section and the title is the caption with the time", async () => {
  const j = journal();
  j.sessionStart("S1");
  const bare = j.ownerPrompt("S1", null);
  const filled = j.ownerPrompt("S1", "с текстом");
  const h = hist(j.entries);
  assert.equal(h.requests.length, 2);
  const r = h.byKey.get(`req:${bare}`);
  assert.equal(r.text, null);
  assert.equal(r.truncated, false);
  assert.equal(
    r.title,
    TX.HISTORY_TITLE_NO_TEXT.replace(
      "{time}",
      fmtDateTime(j.entries[bare].time),
    ),
  );
  assert.equal(h.byKey.get(`req:${filled}`).text, "с текстом");
  // an empty stored text is no text either (the model does not parse lines)
  const raw = [{ ...j.entries[bare], prompt_text: "" }];
  assert.equal(hist(raw).requests[0].text, null);

  const page = await loaded(j.entries);
  const dom = await openWindow(page, `req:${bare}`);
  const line = dom.section("request");
  assert.equal(line.tagName, "P");
  assert.ok(line.classes.has("history-disabled"));
  assert.equal(line.textContent, TX.HISTORY_TEXT_DISABLED);
  assert.equal(dom.body.byClass("history-quote").length, 0);
  assert.equal(
    dom.body.all((e) => e.textContent === TX.HISTORY_SECTION_REQUEST).length,
    0,
    "no heading of the section without a text",
  );
  assert.equal(
    dom.title().textContent,
    TX.HISTORY_TITLE_NO_TEXT.replace(
      "{time}",
      fmtDateTime(j.entries[bare].time),
    ),
  );
  // the other sections stay
  for (const name of ["understood", "work", "timeline"]) {
    assert.ok(dom.section(name) !== undefined, name);
  }
});

// Phrases of the sample screenshot of the owner (docs/design/samples/
// history-view-sample-2026-10-05.jpg), written down here as forbidden; the
// name of the other project on the screenshot is not written (design I7).
const SAMPLE_PHRASES = [
  "Локальный адрес, статус и переподключение",
  "Надо еще показывать где то адрес",
  "Виджет адреса и статуса в топбаре",
  "health-эндпоинт",
  "Разработчик фронтенда",
  "требование заведено",
  "принято в работу",
  "Как система это поняла",
  "задача назначена",
  "внеплановую проверку",
  "companion-процесса",
  "checkSystemStatus",
  "sysStatus",
  "Готово и проверено вживую",
];

test("PG-25: the window is built only from the lines of the journal - an empty journal has no requests and no opener; nothing of the sample or of a written text is in public/; two fixtures show only their own strings and times", async () => {
  // an empty journal
  const empty = hist([]);
  assert.equal(empty.requests.length, 0);
  assert.equal(empty.byKey.size, 0);
  assert.equal(empty.windowOfTask.size, 0);
  assert.equal(empty.windowOfMainRow.size, 0);
  let page = await loaded([]);
  assert.equal(historyRows(page).length, 0);
  assert.equal(historyButtons(page).length, 0);
  assert.equal(historyDom(page).overlay.hidden, true);
  assert.equal(historyDom(page).body.children.length, 0);

  // lines that open nothing: no owner message (old lines, service, orphan note)
  const j = journal();
  j.sessionStart("S1");
  j.prompt("S1");
  j.servicePrompt("S1");
  launchLine(j, "a9");
  const orphan = "Запись без запроса ЯЯЯ";
  j.note({ note_text: orphan, request_time: j.entries[1].time });
  assert.equal(hist(j.entries).requests.length, 0);
  page = await loaded(j.entries);
  assert.equal(historyRows(page).length, 0);
  assert.equal(historyButtons(page).length, 0);
  assert.equal(page.doc.root.textContent.includes(orphan), false);

  // the strings of the window are the strings of the fixture
  const grab = async (entries) => {
    const p = await loaded(entries);
    const key = `req:${hist(entries).requests[0].index}`;
    const dom = await openWindow(p, key);
    return { dom, text: dom.body.textContent, p };
  };
  const a = historyFixture();
  const resA = await grab(a.entries);
  assert.ok(resA.text.includes(HISTORY_TEXT.split("\n")[0]));
  assert.ok(resA.text.includes("Проект окна"));
  assert.ok(resA.text.includes(HISTORY_NOTE_TEXT.split("\n")[0]));
  const b = journal();
  b.sessionStart("SX");
  const ob = b.ownerPrompt("SX", "Совсем другой текст ББ");
  b.note({
    session_id: "SX",
    request_time: b.entries[ob].time,
    req_id: "REQ-777",
    note_text: "Другое понимание ББ",
  });
  b.post("SX", "tu-q", "q1", {
    subagentType: "Explore",
    description: "Описание ББ",
  });
  b.subStart("SX", "q1", "Explore");
  const resB = await grab(b.entries);
  for (const s of [
    "Совсем другой текст ББ",
    "Другое понимание ББ",
    "Описание ББ",
    "REQ-777",
  ]) {
    assert.ok(resB.text.includes(s), s);
    assert.equal(resA.text.includes(s), false, `A has ${s}`);
  }
  for (const s of [
    "Проект окна",
    "Первая строка запроса",
    "Понял так",
    "REQ-008",
  ]) {
    assert.equal(resB.text.includes(s), false, `B has ${s}`);
  }
  // every time of the timeline is the time of a line of the journal
  const times = new Set(a.entries.map((e) => fmtTimeSec(e.time)));
  const shown = resA.dom.body
    .byClass("history-event")
    .map((li) => li.byClass("time")[0].textContent);
  assert.ok(shown.length > 0);
  for (const t of shown)
    assert.ok(times.has(t), `a time ${t} is not in the journal`);

  // nothing is written in public/: neither the sample nor a text of the fixtures
  const forbidden = [
    ...SAMPLE_PHRASES,
    "Первая строка запроса",
    "Проект окна",
    "Понял так",
    "Совсем другой текст",
    "Другое понимание",
  ];
  for (const f of fs.readdirSync(PUBLIC)) {
    const text = fs.readFileSync(path.join(PUBLIC, f), "utf8").toLowerCase();
    for (const phrase of forbidden) {
      assert.equal(
        text.includes(phrase.toLowerCase()),
        false,
        `${f}: ${phrase}`,
      );
    }
  }
});

function launchLine(j, id) {
  j.post("S1", `tu-${id}`, id, { subagentType: "Explore" });
  return j.subStart("S1", id, "Explore");
}

const OMIT_INDEX = [
  "first_index",
  "last_index",
  "first_start_index",
  "last_start_index",
  "end_index",
  "stop_indices",
  "start_index",
];
function withoutIndexes(list) {
  return list.map((item) => {
    const copy = { ...item };
    for (const k of OMIT_INDEX) delete copy[k];
    if (typeof copy.key === "string" && copy.key.startsWith("main:"))
      delete copy.key;
    return copy;
  });
}

test("PG-26: records of the orchestrator change neither the tasks, the rows of the main session, the marks, the sessions nor the office; on the page the panels and the characters stay as they were", async () => {
  const fx = historyFixture();
  const base = fx.entries.filter((e) => e.source !== "ORCH");
  const t = base[base.length - 1].time;
  const notes = [
    noteEntry(t, { request_time: base[1].time, note_text: "ещё запись" }),
    noteEntry(t, { session_id: "S1", note_text: "без времени запроса" }),
    noteEntry(t, {
      request_time: "2020-01-01T00:00:00.000Z",
      note_text: "ничья",
    }),
  ];
  // appended at the end: everything equal, also the office
  const m0 = model(base);
  const m1 = model([...base, ...notes]);
  for (const k of ["tasks", "mainRows", "sessions", "list", "journal"]) {
    assert.deepEqual(m1[k], m0[k], k);
  }
  assert.deepEqual(m1.marks.slice(0, base.length), m0.marks);
  assert.deepEqual(m1.trusted.slice(0, base.length), m0.trusted);
  for (let i = base.length; i < m1.trusted.length; i += 1) {
    assert.equal(
      m1.trusted[i],
      false,
      "a record is never trusted as a hook line",
    );
  }
  assert.deepEqual(buildOffice(m1), buildOffice(m0));
  // in the middle: the same, but for the numbers of the lines
  const mid = [...base.slice(0, 2), ...notes, ...base.slice(2)];
  const m2 = model(mid);
  assert.deepEqual(withoutIndexes(m2.tasks), withoutIndexes(m0.tasks));
  assert.deepEqual(withoutIndexes(m2.mainRows), withoutIndexes(m0.mainRows));
  assert.deepEqual(withoutIndexes(m2.sessions), withoutIndexes(m0.sessions));
  assert.deepEqual(
    m2.journal.length,
    m0.journal.length,
    "a record is no row of the journal",
  );

  // the page: before and after a record arrives
  const page = await loaded(base);
  const snap = () => ({
    tasks: page.el("tasks").textContent,
    rows: page.rows().map((r) => r.textContent),
    legend: page.legend().map((b) => b.textContent),
    now: page.text("now"),
    characters: JSON.stringify(page.app.getOffice().characters),
  });
  const before = snap();
  await page.push(
    noteEntry(t, { request_time: base[1].time, note_text: "ещё запись" }),
  );
  assert.equal(page.app.getModel().entries.length, base.length + 1);
  assert.deepEqual(snap(), before);
  assert.equal(page.rows().length, before.rows.length);
});

test("PG-27: the criterion fixture - title, meta, text with paragraphs, table with ordinals, states and a dash, timeline with the note signed 'Оркестратор записал'; the rules of title, status, truncation and a request without tasks or with many", async () => {
  const fx = historyFixture();
  const { idx, entries } = fx;
  const h = hist(entries);
  assert.equal(h.requests.length, 1, "the service message opens no window");
  const r = h.requests[0];
  assert.equal(r.key, `req:${idx.owner}`);
  assert.equal(r.text, HISTORY_TEXT);
  assert.equal(r.title, `REQ-008 — ${HISTORY_NOTE_TEXT.split("\n")[0]}`);
  assert.equal(r.note.text, HISTORY_NOTE_TEXT);
  assert.equal(r.started_at, entries[idx.owner].time);
  assert.equal(r.finished_at, null);
  assert.equal(r.state, "in_progress", "the service row is the last row");
  assert.deepEqual(
    r.tasks.map((t) => [t.ordinal, t.key, t.role, t.description, t.state]),
    [
      [1, "a1", "Plan", "Проект окна", "completed"],
      [2, "a2", "Explore", null, "in_progress"],
    ],
  );
  assert.deepEqual(mapOf(r.timeline), [
    [TX.MAIN_LABEL, TX.EVENT_LABELS.UserPromptSubmit],
    [TX.HISTORY_WHO_ORCH, TX.HISTORY_NOTE_BY],
    [TX.MAIN_LABEL, TX.EVENT_LABELS.PostToolUse],
    ["Plan", TX.EVENT_LABELS.SubagentStart],
    ["Explore", TX.EVENT_LABELS.SubagentStart],
    ["Plan", TX.EVENT_LABELS.SubagentStop],
    [TX.MAIN_LABEL, TX.HISTORY_SERVICE],
  ]);
  assert.equal(r.timeline[1].detail, HISTORY_NOTE_TEXT);
  assert.equal(r.timeline[0].detail, null);

  const page = await loaded(entries);
  const dom = await openWindow(page, r.key);
  // order, top to bottom
  const kids = dom.body.children;
  assert.equal(kids[0].textContent, TX.HISTORY_BADGE);
  assert.equal(kids[1].tagName, "H2");
  assert.ok(kids[1] === dom.title());
  assert.equal(kids[1].textContent, r.title);
  assert.ok(kids[2] === dom.meta());
  assert.deepEqual(
    kids.slice(3).map((k) => k.dataset.section),
    ["request", "understood", "work", "timeline"],
  );
  assert.equal(dom.dialog.getAttribute("aria-labelledby"), "history-title");
  // meta: no "завершён" without a Stop
  assert.equal(
    dom.meta().textContent,
    `${TX.STATE_LABELS.in_progress} · ${TX.HISTORY_META_STARTED} ${fmtDateTime(r.started_at)}`,
  );
  assert.equal(
    dom.meta().textContent.includes(TX.HISTORY_META_FINISHED),
    false,
  );
  // the text keeps its paragraphs as one text
  const quote = dom.section("request").byClass("history-quote")[0];
  assert.equal(quote.textContent, HISTORY_TEXT);
  assert.equal(dom.section("request").byClass("history-truncated").length, 0);
  // the understanding
  const by = dom.section("understood").byClass("history-by")[0];
  assert.equal(
    by.textContent,
    `${TX.HISTORY_NOTE_BY} · ${fmtTimeSec(r.note.time)}`,
  );
  assert.equal(
    dom.section("understood").byClass("history-quote")[0].textContent,
    HISTORY_NOTE_TEXT,
  );
  assert.equal(dom.body.byClass("history-auto").length, 0);
  // the table
  const table = dom.section("work").byClass("history-table")[0];
  assert.deepEqual(
    table.all((e) => e.tagName === "TH").map((e) => e.textContent),
    [
      TX.HISTORY_COL_TASK,
      TX.HISTORY_COL_AGENT,
      TX.HISTORY_COL_DOES,
      TX.HISTORY_COL_RESULT,
    ],
  );
  const trs = table.all(
    (e) => e.tagName === "TR" && e.dataset.key !== undefined,
  );
  assert.deepEqual(
    trs.map((e) => [e.dataset.key, e.dataset.state]),
    [
      ["a1", "completed"],
      ["a2", "in_progress"],
    ],
  );
  const cells = (tr) => tr.children.map((td) => td.textContent);
  const t1 = r.tasks[0];
  const t2 = r.tasks[1];
  assert.deepEqual(cells(trs[0]), [
    `${TX.HISTORY_TASK_N.replace("{n}", "1")}${TX.STATE_LABELS.completed}`,
    `${TX.HISTORY_COL_AGENT}Plan`,
    `${TX.HISTORY_COL_DOES}Проект окна`,
    `${TX.HISTORY_COL_RESULT}${TX.LABEL_STARTED} ${fmtTime(t1.started_at)} · ${TX.LABEL_ENDED} ${fmtTime(t1.ended_at)}`,
  ]);
  assert.deepEqual(cells(trs[1]), [
    `${TX.HISTORY_TASK_N.replace("{n}", "2")}${TX.STATE_LABELS.in_progress}`,
    `${TX.HISTORY_COL_AGENT}Explore`,
    `${TX.HISTORY_COL_DOES}${TX.HISTORY_EMPTY_CELL}`,
    `${TX.HISTORY_COL_RESULT}${TX.LABEL_STARTED} ${fmtTime(t2.started_at)} · ${TX.LABEL_LAST_EVENT} ${fmtTime(t2.session_last_event_at)}`,
  ]);
  // the timeline: one li per item, the note signed, the service message named
  const lis = dom.section("timeline").byClass("history-event");
  assert.equal(lis.length, r.timeline.length);
  assert.deepEqual(
    lis.map((li) => [
      li.byClass("who")[0].textContent,
      li.byClass("what")[0].textContent,
    ]),
    mapOf(r.timeline),
  );
  assert.deepEqual(
    lis.map((li) => li.byClass("time")[0].textContent),
    r.timeline.map((i) => fmtTimeSec(i.time)),
  );
  assert.equal(lis[1].dataset.kind, "note");
  assert.equal(lis[1].byClass("what")[0].textContent, TX.HISTORY_NOTE_BY);
  assert.equal(
    lis[1].byClass("history-note-text")[0].textContent,
    HISTORY_NOTE_TEXT,
  );
  assert.equal(lis[2].byClass("history-detail")[0].textContent, "Проект окна");
  assert.equal(lis[0].byClass("history-detail").length, 0);

  // a finished request: "завершён" with the time of the last Stop of the main session
  const j = journal();
  j.sessionStart("S2");
  const o = j.ownerPrompt("S2", "завершённый запрос");
  launchLine2(j, "S2", "b1");
  j.subStop("S2", "b1", "Explore");
  const stop = j.stop("S2");
  const done = hist(j.entries).requests[0];
  assert.equal(done.state, "completed");
  assert.equal(done.finished_at, j.entries[stop].time);
  const p2 = await loaded(j.entries);
  const d2 = await openWindow(p2, `req:${o}`);
  assert.equal(
    d2.meta().textContent,
    `${TX.STATE_LABELS.completed} · ${TX.HISTORY_META_STARTED} ${fmtDateTime(done.started_at)} · ${TX.HISTORY_META_FINISHED} ${fmtDateTime(done.finished_at)}`,
  );
  // closed by the next message, no Stop: unrecorded and no "завершён"
  const k = journal();
  k.sessionStart("S2");
  const o1 = k.ownerPrompt("S2", "первый");
  k.ownerPrompt("S2", "второй");
  const first = hist(k.entries).byKey.get(`req:${o1}`);
  assert.equal(first.state, "unrecorded");
  assert.equal(first.finished_at, null);
  const p3 = await loaded(k.entries);
  const d3 = await openWindow(p3, `req:${o1}`);
  assert.equal(
    d3.meta().textContent,
    `${TX.STATE_LABELS.unrecorded} · ${TX.HISTORY_META_STARTED} ${fmtDateTime(first.started_at)}`,
  );
  assert.equal(d3.meta().textContent.includes(TX.HISTORY_META_FINISHED), false);
  assert.equal(
    d3.section("work").byClass("history-none")[0].textContent,
    TX.HISTORY_NO_TASKS,
  );
  assert.equal(d3.section("work").byClass("history-table").length, 0);
});

function launchLine2(j, session, id) {
  j.post(session, `tu-${id}`, id, { subagentType: "Explore" });
  return j.subStart(session, id, "Explore");
}

test("PG-27b: the title by the rules - requirement and first line of the note, else the first line of the text cut at 120 code points, else the caption with the time; a truncated text says how many characters are shown; a request with 300 tasks shows all of them", async () => {
  const j = journal();
  j.sessionStart("S1");
  const long = "я".repeat(150);
  const emoji = "😀".repeat(130);
  const oLong = j.ownerPrompt("S1", `  \n${long}\nвторая`);
  const oEmoji = j.ownerPrompt("S1", emoji, { prompt_truncated: true });
  const oNote = j.ownerPrompt("S1", "текст запроса");
  j.note({
    request_time: j.entries[oNote].time,
    req_id: "REQ-123",
    note_text: "\n\nпервая строка записи\nвторая строка",
  });
  const oNoReq = j.ownerPrompt("S1", "текст без номера");
  j.note({
    request_time: j.entries[oNoReq].time,
    note_text: "запись без номера",
  });
  const h = hist(j.entries);
  assert.equal(h.byKey.get(`req:${oLong}`).title, `${"я".repeat(120)}…`);
  assert.equal(Array.from(h.byKey.get(`req:${oEmoji}`).title).length, 121);
  assert.equal(
    h.byKey.get(`req:${oNote}`).title,
    "REQ-123 — первая строка записи",
  );
  assert.equal(
    h.byKey.get(`req:${oNoReq}`).title,
    "текст без номера",
    "a record without a number does not change the title",
  );
  assert.equal(h.byKey.get(`req:${oEmoji}`).truncated, true);
  assert.equal(h.byKey.get(`req:${oLong}`).truncated, false);

  const page = await loaded(j.entries);
  let dom = await openWindow(page, `req:${oEmoji}`);
  const note = dom.section("request").byClass("history-truncated")[0];
  assert.equal(note.textContent, fillN(TX.HISTORY_TRUNCATED, 130));
  page.el("history-close").click();
  dom = await openWindow(page, `req:${oLong}`);
  assert.equal(dom.section("request").byClass("history-truncated").length, 0);
  page.el("history-close").click();

  // many rows: all of them are shown, nothing is cut
  const big = journal();
  big.sessionStart("S1");
  const o = big.ownerPrompt("S1", "много задач");
  for (let n = 0; n < 300; n += 1) {
    big.post("S1", `tu-${n}`, `t${n}`, {
      subagentType: "Explore",
      description: `задача ${n}`,
    });
    big.subStart("S1", `t${n}`, "Explore");
    big.subStop("S1", `t${n}`, "Explore");
  }
  const r = hist(big.entries).byKey.get(`req:${o}`);
  assert.equal(r.tasks.length, 300);
  assert.deepEqual(
    r.tasks.map((t) => t.ordinal),
    Array.from({ length: 300 }, (_v, i) => i + 1),
  );
  const pb = await loaded(big.entries);
  // the journal shows only the last 200 rows: the window opens from a card
  assert.ok(historyButtons(pb).length > 0);
  historyButtons(pb)[0].click();
  const db = historyDom(pb);
  assert.equal(db.isOpen(), true);
  assert.equal(db.title().textContent, r.title);
  assert.equal(
    db
      .section("work")
      .all((e) => e.tagName === "TR" && e.dataset.key !== undefined).length,
    300,
  );
  assert.equal(
    db.section("timeline").byClass("history-event").length,
    r.timeline.length,
  );
  assert.ok(r.timeline.length >= 900);
});

// Two lines of a request that share the time of the message of two sessions.
function sameTimeJournal() {
  const j = journal();
  j.sessionStart("SA");
  j.sessionStart("SB");
  j.time(99);
  const a = j.ownerPrompt("SA", "запрос A");
  j.time(99);
  const b = j.ownerPrompt("SB", "запрос B");
  return { j, a, b, t: j.entries[a].time };
}

test("PG-28: binding of the records of the orchestrator and the borders of the window - the latest record is shown, the earlier ones stay in the timeline; the time of the record decides, a session tells only between equal times; auto is signed; no record has its own line; the borders", async () => {
  // the latest by time, then by the number of the line
  {
    const j = journal();
    j.sessionStart("S1");
    const o = j.ownerPrompt("S1", "запрос");
    const rt = j.entries[o].time;
    j.note({
      session_id: "S1",
      request_time: rt,
      note_text: "ранняя запись",
      req_id: "REQ-001",
    });
    const n2 = j.note({
      session_id: "S1",
      request_time: rt,
      note_text: "поздняя запись",
      req_id: "REQ-002",
    });
    // a record later by number but earlier by time
    j.raw(
      noteEntry(at(1), { request_time: rt, note_text: "старая по времени" }),
    );
    // two records of one time: the larger number is the later one
    j.raw(noteEntry(at(500), { request_time: rt, note_text: "равная первая" }));
    const n5 = j.raw(
      noteEntry(at(500), { request_time: rt, note_text: "равная вторая" }),
    );
    const r = hist(j.entries).requests[0];
    assert.equal(r.note.index, n5);
    assert.equal(r.note.text, "равная вторая");
    assert.deepEqual(
      r.notes.map((n) => n.text),
      [
        "ранняя запись",
        "поздняя запись",
        "старая по времени",
        "равная первая",
        "равная вторая",
      ],
    );
    // the latest record has no number: the title is the first line of the text
    assert.equal(r.title, "запрос");
    // without the tie-by-number case the later-by-time one wins
    j.entries.splice(j.entries.length - 2, 2);
    const r2 = hist(j.entries).requests[0];
    assert.equal(r2.note.index, n2);
    assert.equal(r2.title, "REQ-002 — поздняя запись");
    assert.equal(r2.timeline.filter((i) => i.kind === "note").length, 3);
    const page = await loaded(j.entries);
    const dom = await openWindow(page, r2.key);
    assert.equal(
      dom.section("understood").byClass("history-quote")[0].textContent,
      "поздняя запись",
    );
    assert.equal(
      dom.section("understood").textContent.includes("ранняя запись"),
      false,
    );
    const tl = dom.section("timeline").textContent;
    assert.ok(tl.includes("ранняя запись") && tl.includes("поздняя запись"));
  }

  // no record: the line of the section, no block, nothing invented
  {
    const j = journal();
    j.sessionStart("S1");
    const o = j.ownerPrompt("S1", "запрос без записи");
    const r = hist(j.entries).requests[0];
    assert.equal(r.note, null);
    assert.deepEqual(r.notes, []);
    const page = await loaded(j.entries);
    const dom = await openWindow(page, `req:${o}`);
    const sec = dom.section("understood");
    assert.equal(
      sec.byClass("history-missing")[0].textContent,
      TX.HISTORY_NOTE_MISSING,
    );
    assert.equal(sec.byClass("history-quote").length, 0);
    assert.equal(sec.byClass("history-by").length, 0);
  }

  // two messages of one time: the session of the record tells; without one, none
  const noteOf = (fields) => {
    const s = sameTimeJournal();
    s.j.note({ request_time: s.t, note_text: "понимание", ...fields });
    const h = hist(s.j.entries);
    return [h.byKey.get(`req:${s.a}`).note, h.byKey.get(`req:${s.b}`).note];
  };
  {
    const [na, nb] = noteOf({ session_id: "SB" });
    assert.equal(na, null);
    assert.equal(nb.text, "понимание");
    const [pa, pb] = noteOf({ session_id: "SA" });
    assert.equal(pa.text, "понимание");
    assert.equal(pb, null);
    assert.deepEqual(
      noteOf({}),
      [null, null],
      "no session: the record is tied to none",
    );
    assert.deepEqual(noteOf({ session_id: "SC" }), [null, null]);
  }
  // one candidate: the time decides, whatever the session of the record
  {
    const j = journal();
    j.sessionStart("S1");
    j.sessionStart("S2");
    const a = j.ownerPrompt("S1", "первый");
    const b = j.ownerPrompt("S2", "второй");
    j.note({
      session_id: "S1",
      request_time: j.entries[b].time,
      note_text: "про второй",
    });
    const h = hist(j.entries);
    assert.equal(h.byKey.get(`req:${a}`).note, null);
    assert.equal(h.byKey.get(`req:${b}`).note.text, "про второй");
    assert.equal(h.byKey.get(`req:${b}`).note.index, j.entries.length - 1);
  }
  // records that tie to no request
  {
    const j = journal();
    j.sessionStart("S1");
    const oldRow = j.prompt("S1");
    const svc = j.servicePrompt("S1");
    const o = j.ownerPrompt("S1", "запрос");
    j.note({ note_text: "без времени" });
    j.note({
      request_time: "2020-01-01T00:00:00.000Z",
      note_text: "другое время",
    });
    j.note({
      request_time: j.entries[oldRow].time,
      note_text: "к старой строке",
    });
    j.note({ request_time: j.entries[svc].time, note_text: "к служебному" });
    const h = hist(j.entries);
    assert.equal(h.requests.length, 1);
    assert.equal(h.byKey.get(`req:${o}`).note, null);
    assert.equal(
      h.byKey.get(`req:${o}`).timeline.filter((i) => i.kind === "note").length,
      0,
    );
  }

  // auto is signed, an explicit time is not
  {
    const j = journal();
    j.sessionStart("S1");
    const a = j.ownerPrompt("S1", "автоматически");
    j.note({
      request_time: j.entries[a].time,
      request_time_auto: true,
      note_text: "авто",
    });
    const b = j.ownerPrompt("S1", "явно");
    j.note({ request_time: j.entries[b].time, note_text: "явная" });
    const h = hist(j.entries);
    const ra = h.byKey.get(`req:${a}`);
    const rb = h.byKey.get(`req:${b}`);
    assert.equal(ra.note.auto, true);
    assert.equal(rb.note.auto, false);
    const page = await loaded(j.entries);
    let dom = await openWindow(page, ra.key);
    assert.equal(
      dom.section("understood").byClass("history-by")[0].textContent,
      `${TX.HISTORY_NOTE_BY} · ${fmtTimeSec(ra.note.time)} · ${TX.HISTORY_NOTE_AUTO}`,
    );
    const li = dom
      .section("timeline")
      .byClass("history-event")
      .find((e) => e.dataset.kind === "note");
    assert.equal(li.byClass("what")[0].textContent, TX.HISTORY_NOTE_BY);
    assert.equal(
      li.byClass("history-auto")[0].textContent,
      ` · ${TX.HISTORY_NOTE_AUTO}`,
    );
    page.el("history-close").click();
    dom = await openWindow(page, rb.key);
    assert.equal(
      dom.section("understood").byClass("history-by")[0].textContent,
      `${TX.HISTORY_NOTE_BY} · ${fmtTimeSec(rb.note.time)}`,
    );
    assert.equal(dom.body.byClass("history-auto").length, 0);
  }

  // borders: the next message of the same session cuts; other sessions and
  // service messages do not; lines before the first message are in no window
  {
    const j = journal();
    j.sessionStart("S1");
    const pre = launchLine(j, "e1");
    const o1 = j.ownerPrompt("S1", "первое");
    launchLine(j, "a1");
    const p1 = j.ownerPrompt("S2", "чужая сессия");
    launchLine2(j, "S2", "b1");
    const svc = j.servicePrompt("S1");
    launchLine(j, "a2");
    j.prompt("S1");
    const o2 = j.ownerPrompt("S1", "второе");
    launchLine(j, "a3");
    launchLine2(j, "S2", "b2");
    const h = hist(j.entries);
    assert.deepEqual(
      h.requests.map((r) => r.index),
      [o1, p1, o2],
    );
    const tasksOf = (i) => h.byKey.get(`req:${i}`).tasks.map((t) => t.key);
    assert.deepEqual(tasksOf(o1), ["a1", "a2"]);
    assert.deepEqual(tasksOf(p1), ["b1", "b2"]);
    assert.deepEqual(tasksOf(o2), ["a3"]);
    assert.equal(h.windowOfTask.has("e1"), false, "before the first message");
    assert.ok(pre < o1);
    assert.equal(h.windowOfTask.get("a2"), `req:${o1}`);
    assert.equal(h.windowOfTask.get("a3"), `req:${o2}`);
    assert.equal(h.windowOfTask.get("b2"), `req:${p1}`);
    assert.equal(h.windowOfMainRow.get(`main:${svc}`), `req:${o1}`);
    assert.equal(h.windowOfMainRow.get(`main:${o1}`), `req:${o1}`);
    assert.equal(h.windowOfMainRow.get(`main:${o2}`), `req:${o2}`);
    // the timeline of a window holds only the lines of its session
    for (const r of h.requests) {
      for (const item of r.timeline.filter((i) => i.kind === "event")) {
        assert.equal(j.entries[item.index].session_id, r.session_id);
        assert.ok(item.index >= r.index);
      }
    }
    assert.equal(
      h.byKey.get(`req:${o1}`).timeline.filter((i) => i.index > o2).length,
      0,
    );
  }
});
