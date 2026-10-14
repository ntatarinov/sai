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
import { ageText, fmtTimeSec } from "../src/pixel-office/public/format.js";
import {
  buildCard,
  buildOffice,
} from "../src/pixel-office/public/office-model.js";
import { nowLine, taskPanel } from "../src/pixel-office/public/panels.js";
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

test("PG-12c1: a server start after the start of a task makes it 'сервер перезапускался…' (REQ-042 criterion 6), not 'окончание не записано'", () => {
  const j = journal();
  j.subStart("S1", "a1", "r");
  const after = model(j.entries, [startAt(1)]).tasks[0];
  assert.equal(after.state, "restarted");
  assert.equal(after.closed_by, "server_start");
  assert.equal(after.ended_at ?? null, null);
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

test("PG-12c6: an end that came after the server start makes the task 'закончила работу, итог не записан' (REQ-042 criterion 6)", () => {
  const j = journal();
  j.subStart("S1", "a1", "r");
  const starts = [startAt(1)];
  assert.equal(model(j.entries, starts).tasks[0].state, "restarted");
  j.subStop("S1", "a1", "r");
  const done = model(j.entries, starts).tasks[0];
  assert.equal(done.state, "completed");
  assert.equal(done.closed_by, "stop");
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
  // REQ-042 design 11: the ten keys of before plus age_ms and
  // session_last_event_at (the age is the model's, not the page's).
  assert.deepEqual(Object.keys(row).sort(), [
    "age_ms",
    "closed_by",
    "end_index",
    "ended_at",
    "key",
    "kind",
    "prompt_kind",
    "session_id",
    "session_last_event_at",
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

test("PG-12d6 (1): request, server start after it, then Stop of the same session - 'сервер перезапускался…', then 'закончила работу' (the named scenario)", () => {
  const j = journal();
  j.prompt("S1");
  let rows = main1(j.entries, [startAt(1)]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].state, "restarted");
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
  assert.equal(rows[0].state, "restarted");
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

test("PG-12d6 (9b): with a server start between the requests the first row is 'сервер перезапускался…' by the server start, the second is in progress", () => {
  const j = journal();
  j.prompt("S1");
  j.prompt("S2");
  const rows = main1(j.entries, [startAt(1)]);
  assert.equal(rows[0].state, "restarted");
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
  // REQ-045: the window opens from the separate button of the row
  const button = row.byClass("history-open")[0];
  assert.ok(button !== undefined, `no button in the row of ${key}`);
  button.click();
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

test("PG-26: records of the orchestrator change neither the tasks, the rows of the main session, the marks, the sessions nor the office; on the page the panels and the characters stay as they were, the journal gets the row of the record", async () => {
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
    noteEntry(t, {
      request_time: base[1].time,
      note_text: "ещё запись",
      req_id: "REQ-008",
    }),
  );
  assert.equal(page.app.getModel().entries.length, base.length + 1);
  // REQ-045: the tasks, the legend, "Сейчас" and the characters stay; the
  // journal gets one row - the record, at its place, in plain words
  const after = snap();
  for (const k of ["tasks", "legend", "now", "characters"]) {
    assert.deepEqual(after[k], before[k], k);
  }
  assert.equal(after.rows.length, before.rows.length + 1);
  assert.deepEqual(after.rows.slice(0, before.rows.length), before.rows);
  const last = page.rows()[page.rows().length - 1];
  assert.equal(last.dataset.index, String(base.length));
  assert.equal(last.dataset.kind, "note");
  assert.equal(
    last.byClass("event")[0].textContent,
    "Оркестратор записал, как понял запрос",
  );
  assert.equal(last.byClass("who")[0].textContent, "Оркестратор");
  assert.equal(last.textContent.includes("ещё запись"), false);
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
    // REQ-045: the words of the cases 3, 10, 7, 9 and 4, written as literals
    [TX.MAIN_LABEL, "Владелец отправил запрос"],
    [TX.HISTORY_WHO_ORCH, TX.HISTORY_NOTE_BY],
    [TX.MAIN_LABEL, "Задание передано агенту «Plan»"],
    ["Plan", "Агент «Plan» получил задание и начал работу"],
    ["Explore", "Агент «Explore» получил задание и начал работу"],
    ["Plan", "Агент «Plan» закончил работу и вернул ответ"],
    [TX.MAIN_LABEL, "В сессию пришло служебное сообщение"],
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

// ===================================================================
// REQ-042: state honesty (design 10: FS-01 ... FS-19). "Now" is a number given
// by the test; the real clock is never read.
// ===================================================================
import { ageOf, ITEM_STATES } from "../src/pixel-office/public/model.js";
import {
  STALE_AFTER_MS,
  checkLine,
} from "../src/pixel-office/public/schema.js";
import {
  FIXTURES,
  WORDS,
  iso,
  lineAt,
  readFixture,
  startRec,
} from "./pixel-office-helpers.js";

// 70 minutes after T0: everything that happened at T0 is "no fresh data".
const FAR = T0 + STALE_AFTER_MS + 600_000;
const sub = (session, id, ms, type = "Explore") =>
  lineAt("SubagentStart", session, ms, { agent_id: id, agent_type: type });
const subEnd = (session, id, ms, type = "Explore") =>
  lineAt("SubagentStop", session, ms, { agent_id: id, agent_type: type });
const tool = (session, ms, id = "tu-x") =>
  lineAt("PostToolUse", session, ms, {
    tool_use_id: id,
    launched_agent_id: "nobody",
  });
const taskOf = (m, key = "a1") => m.tasks.find((t) => t.key === key);

// The table of design 3.2: the reason of closing goes with the state.
function assertInvariant(m, where = "") {
  const rule = {
    in_progress: { task: null, row: [null] },
    stale: { task: null, row: [null] },
    restarted: { task: "server_start", row: ["server_start"] },
    completed: { task: "stop", row: ["stop"] },
    unrecorded: { task: "session_end", row: ["next_prompt", "session_end"] },
  };
  for (const t of m.tasks) {
    assert.ok(ITEM_STATES.includes(t.state), `${where}: state ${t.state}`);
    assert.equal(t.closed_by, rule[t.state].task, `${where}: ${t.key}`);
    assert.equal(
      t.ended_at !== null,
      t.state === "completed",
      `${where}: ended_at of ${t.key}`,
    );
  }
  for (const r of m.mainRows) {
    assert.ok(ITEM_STATES.includes(r.state), `${where}: state ${r.state}`);
    assert.ok(rule[r.state].row.includes(r.closed_by), `${where}: ${r.key}`);
    assert.equal(
      r.ended_at !== null,
      r.state === "completed",
      `${where}: ended_at of ${r.key}`,
    );
  }
  for (const item of m.list) {
    if (item.state === "in_progress") {
      assert.ok(
        item.age_ms !== null && item.age_ms <= STALE_AFTER_MS,
        `${where}: ${item.key} in progress with age ${item.age_ms}`,
      );
    }
    if (item.state === "stale") {
      assert.ok(
        item.age_ms === null || item.age_ms > STALE_AFTER_MS,
        `${where}: ${item.key} stale with age ${item.age_ms}`,
      );
    }
  }
}

// The same lines on the page itself: the item with the key and its word.
async function onPage(entries, starts, now) {
  const page = await loaded(entries, starts, { now });
  const found = new Map();
  for (const item of page.items()) {
    found.set(item.dataset.key, {
      state: item.dataset.state,
      word: item.byClass("item-state")[0].textContent,
    });
  }
  return { page, found };
}

// ------------------------------------------------------------------ FS-01

test("FS-01: only trusted lines of the hook decide - a line of the orchestrator and a line of another source with the time 'now' change neither the state, nor the word of the session, nor the time and age of its last event, nor N; a REAL line does", async () => {
  const now = FAR;
  const old = [
    lineAt("SessionStart", "S1", T0),
    sub("S1", "a1", T0 + 1000),
    lineAt("PostToolUse", "S1", T0 + 2000, {
      tool_use_id: "tu1",
      launched_agent_id: "a1",
      subagent_type: "Explore",
      description: "old work",
    }),
  ];
  const page = await loaded(old, [], { now });
  const snapshot = () => ({
    items: page.items().map((i) => i.textContent),
    states: page.items().map((i) => i.dataset.state),
    cards: page
      .el("tasks")
      .byClass("session-card")
      .map((c) => ({
        word: c.dataset.word,
        text: c.textContent,
      })),
    now: page.text("now-text"),
    title: page.el("now").title,
    last: page.app.getModel().sessions.map((s) => [s.last_event_at, s.age_ms]),
    n: page.app.getModel().unconfirmed.count,
  });
  const before = snapshot();
  assert.deepEqual(before.states, ["stale"]);
  assert.equal(before.cards[0].word, "stale");
  assert.equal(before.n, 1);
  assert.equal(
    before.now,
    "Сейчас: в работе ничего нет · без свежих данных: 1",
  );

  // a record of the orchestrator for the same session, the time is "now"
  page.server.entries.push(
    noteEntry(iso(now), { session_id: "S1", note_text: "как понял: пример" }),
  );
  await page.tick(2000);
  // a line of another source, not REAL, the time is "now"
  page.server.entries.push({
    ...tool("S1", page.clock.now(), "tu-sim"),
    source: "SIMULATION",
  });
  await page.tick(2000);
  // the page clock moved by 4 s: the age is allowed to grow, nothing else is
  const after = snapshot();
  assert.equal(page.app.getModel().entries.length, old.length + 2);
  assert.deepEqual(after.states, before.states);
  assert.deepEqual(
    after.cards.map((c) => c.word),
    ["stale"],
  );
  assert.deepEqual(
    after.last.map((x) => x[0]),
    before.last.map((x) => x[0]),
  );
  assert.equal(after.n, 1);
  assert.equal(after.now, before.now);
  assert.equal(after.items.length, before.items.length);
  const model = page.app.getModel();
  assert.equal(model.sessions[0].last_event_at, iso(T0 + 2000));
  assert.equal(model.sessions[0].word, "stale");
  assert.equal(model.unconfirmed.oldest_stale_age_ms, model.tasks[0].age_ms);

  // a line of the hook, REAL, the same session, the time "now"
  page.server.entries.push(tool("S1", page.clock.now(), "tu-real"));
  await page.tick(2000);
  assert.deepEqual(
    page.items().map((i) => i.dataset.state),
    ["in_progress"],
  );
  const card = page.el("tasks").byClass("session-card")[0];
  assert.equal(card.dataset.word, "running");
  assert.equal(card.byClass("age")[0].textContent, "меньше минуты назад");
  assert.equal(page.app.getModel().unconfirmed.count, 0);
});

// ------------------------------------------------------------------ FS-02

const BASE_TASK = [
  lineAt("SessionStart", "S1", T0),
  sub("S1", "a1", T0 + 1000),
];

// [name, lines after the base, records of server starts, the page clock,
//  the expected {state, closed_by}]
const TASK_SCENARIOS = [
  ["no fresh data: only the base", [], [], FAR, "stale", null],
  [
    "no fresh data, then PostToolUse of the session - in progress",
    [tool("S1", FAR - 1000)],
    [],
    FAR,
    "in_progress",
    null,
  ],
  [
    "no fresh data, then SessionEnd after the start - 'окончание не записано'",
    [lineAt("SessionEnd", "S1", FAR - 1000)],
    [],
    FAR,
    "unrecorded",
    "session_end",
  ],
  [
    "no fresh data, then SubagentStop - the word of the one who finished",
    [subEnd("S1", "a1", FAR - 1000)],
    [],
    FAR,
    "completed",
    "stop",
  ],
  [
    "no fresh data, then a repeated SubagentStart - in progress again",
    [sub("S1", "a1", FAR - 1000)],
    [],
    FAR,
    "in_progress",
    null,
  ],
  [
    "server restarted: the word is kept at the very start",
    [],
    [startRec(2)],
    FAR,
    "restarted",
    "server_start",
  ],
  [
    "server restarted, then PostToolUse of the session - the state is as before (a fresh event does not revive it)",
    [tool("S1", FAR - 1000)],
    [startRec(2)],
    FAR,
    "restarted",
    "server_start",
  ],
  [
    "server restarted, then a repeated SubagentStart of the same agent_id - in progress",
    [sub("S1", "a1", FAR - 1000)],
    [startRec(2)],
    FAR,
    "in_progress",
    null,
  ],
  [
    "server restarted, then SubagentStop - the word of the one who finished",
    [subEnd("S1", "a1", FAR - 1000)],
    [startRec(2)],
    FAR,
    "completed",
    "stop",
  ],
  [
    "server restarted, then SessionEnd after the start - 'окончание не записано'",
    [lineAt("SessionEnd", "S1", FAR - 1000)],
    [startRec(2)],
    FAR,
    "unrecorded",
    "session_end",
  ],
  [
    "SessionEnd BEFORE the server start (item 2 before item 3) - 'окончание не записано', not the word about the restart",
    [lineAt("SessionEnd", "S1", T0 + 2000)],
    [startRec(3)],
    FAR,
    "unrecorded",
    "session_end",
  ],
  [
    "'окончание не записано' (SessionEnd), then PostToolUse - as before",
    [lineAt("SessionEnd", "S1", T0 + 2000), tool("S1", FAR - 1000)],
    [],
    FAR,
    "unrecorded",
    "session_end",
  ],
  [
    "'окончание не записано' (SessionEnd), then SubagentStop - the word of the one who finished",
    [lineAt("SessionEnd", "S1", T0 + 2000), subEnd("S1", "a1", FAR - 1000)],
    [],
    FAR,
    "completed",
    "stop",
  ],
  [
    "the restarted word does not age: a year later it is the same",
    [],
    [startRec(2)],
    FAR + 365 * 24 * 3600 * 1000,
    "restarted",
    "server_start",
  ],
];

test("FS-02: the transitions of a task - the five scenarios of criterion 2 and the table of design 4.4, on the model and on the page; the reason of closing goes with the state", async () => {
  for (const [name, after, starts, now, state, closedBy] of TASK_SCENARIOS) {
    const entries = [...BASE_TASK, ...after];
    const m = buildModel(entries, starts, now);
    assertInvariant(m, name);
    const t = taskOf(m);
    assert.equal(t.state, state, name);
    assert.equal(t.closed_by, closedBy, name);
    // the same on the page: the word of the item is the word of the state
    const { found } = await onPage(entries, starts, now);
    assert.deepEqual(found.get("a1"), { state, word: WORDS[state] }, name);
  }
});

// ------------------------------------------------------------------ FS-03

const BASE_ROW = [
  lineAt("SessionStart", "S1", T0),
  lineAt("UserPromptSubmit", "S1", T0 + 1000),
];
const prompt = (ms, session = "S1") => lineAt("UserPromptSubmit", session, ms);
const stopAt = (ms, session = "S1") => lineAt("Stop", session, ms);

// [name, lines after the base, starts, now, expected rows as
//  [state, closed_by] in the order of the file]
const ROW_SCENARIOS = [
  ["no fresh data", [], [], FAR, [["stale", null]]],
  [
    "no fresh data, then the next request - the old row 'окончание не записано', a new one in progress",
    [prompt(FAR - 1000)],
    [],
    FAR,
    [
      ["unrecorded", "next_prompt"],
      ["in_progress", null],
    ],
  ],
  [
    "no fresh data, then SessionEnd - 'окончание не записано'",
    [lineAt("SessionEnd", "S1", FAR - 1000)],
    [],
    FAR,
    [["unrecorded", "session_end"]],
  ],
  [
    "no fresh data, then Stop - the word of the one who finished",
    [stopAt(FAR - 1000)],
    [],
    FAR,
    [["completed", "stop"]],
  ],
  [
    "no fresh data, then PostToolUse of the session - in progress, still one row",
    [tool("S1", FAR - 1000)],
    [],
    FAR,
    [["in_progress", null]],
  ],
  [
    "no fresh data, then Stop of ANOTHER session - nothing changes",
    [stopAt(FAR - 1000, "S2")],
    [],
    FAR,
    [["stale", null]],
  ],
  [
    "request, a record of a server start, Stop - the word of the one who finished",
    [stopAt(FAR - 1000)],
    [startRec(2)],
    FAR,
    [["completed", "stop"]],
  ],
  [
    "request, a record of a server start, no Stop - the word about the restart",
    [],
    [startRec(2)],
    FAR,
    [["restarted", "server_start"]],
  ],
  [
    "request, a record of a server start, the next request - the old row 'окончание не записано'",
    [prompt(FAR - 1000)],
    [startRec(2)],
    FAR,
    [
      ["unrecorded", "next_prompt"],
      ["in_progress", null],
    ],
  ],
  [
    "request, a record of a server start, SessionEnd - 'окончание не записано', not the word about the restart",
    [lineAt("SessionEnd", "S1", FAR - 1000)],
    [startRec(2)],
    FAR,
    [["unrecorded", "session_end"]],
  ],
  [
    "the row closed by the restart, then PostToolUse - as before",
    [tool("S1", FAR - 1000)],
    [startRec(2)],
    FAR,
    [["restarted", "server_start"]],
  ],
  [
    "a row closed by the next request, then Stop - the old row as it was, the Stop closes the new one, no third row",
    [prompt(T0 + 2000), stopAt(FAR - 1000)],
    [],
    FAR,
    [
      ["unrecorded", "next_prompt"],
      ["completed", "stop"],
    ],
  ],
  [
    "a row closed by SessionEnd, then Stop - the row as it was, no new row",
    [lineAt("SessionEnd", "S1", T0 + 2000), stopAt(FAR - 1000)],
    [],
    FAR,
    [["unrecorded", "session_end"]],
  ],
  [
    "a second Stop after the first - nothing changes, no row appears",
    [stopAt(T0 + 2000), stopAt(FAR - 1000)],
    [],
    FAR,
    [["completed", "stop"]],
  ],
];

test("FS-03: the transitions of a row of the main session - the seven scenarios of criterion 2 and the table of design 4.4; a Stop invents no row", async () => {
  for (const [name, after, starts, now, rows] of ROW_SCENARIOS) {
    const entries = [...BASE_ROW, ...after];
    const m = buildModel(entries, starts, now);
    assertInvariant(m, name);
    assert.deepEqual(
      m.mainRows.map((r) => [r.state, r.closed_by]),
      rows,
      name,
    );
    // the same on the page: the items of the main session and their words
    const page = await loaded(entries, starts, { now });
    const shown = new Map(
      page
        .items()
        .filter((i) => i.dataset.kind === "main")
        .map((i) => [
          i.dataset.key,
          [i.dataset.state, i.byClass("item-state")[0].textContent],
        ]),
    );
    assert.equal(shown.size, m.mainRows.length, name);
    for (const r of m.mainRows) {
      assert.deepEqual(shown.get(r.key), [r.state, WORDS[r.state]], name);
    }
  }
});

// ------------------------------------------------------------------ FS-04

// Lines of every file of public/ that match; like `grep -rn`.
function grepPublic(re) {
  const out = [];
  for (const name of fs.readdirSync(PUBLIC).sort()) {
    const file = path.join(PUBLIC, name);
    if (!fs.statSync(file).isFile()) continue;
    fs.readFileSync(file, "utf8")
      .split("\n")
      .forEach((text, i) => {
        if (re.test(text)) out.push({ name, line: i + 1, text });
      });
  }
  return out;
}

const THRESHOLD_LITERAL = /3600000|3_600_000|60 \* 60 \* 1000/;

test("FS-04: STALE_AFTER_MS is 3600000 and is the only place of the number - one 'export const', one line with the literal, none in format.js", () => {
  assert.equal(STALE_AFTER_MS, 3600000);
  const defs = grepPublic(/STALE_AFTER_MS/).filter((l) =>
    l.text.includes("export const"),
  );
  assert.equal(defs.length, 1, "one 'export const STALE_AFTER_MS'");
  const literals = grepPublic(THRESHOLD_LITERAL);
  assert.equal(literals.length, 1, JSON.stringify(literals));
  assert.equal(literals[0].name, "schema.js");
  assert.ok(literals[0].text.includes("export const STALE_AFTER_MS"));
  assert.equal(
    literals.some((l) => l.name === "format.js"),
    false,
    "the age format takes its units from its own constants",
  );
  // the expressions themselves: a duplicated number or constant is seen
  const two = "export const A = 3600000;\nconst b = 60 * 60 * 1000;";
  assert.equal(
    two.split("\n").filter((l) => THRESHOLD_LITERAL.test(l)).length,
    2,
  );
  assert.equal(THRESHOLD_LITERAL.test("const c = MS_PER_MINUTE * 60;"), false);
});

// ------------------------------------------------------------------ FS-05

test("FS-05: the border - exactly STALE_AFTER_MS is 'в работе', one millisecond more is 'нет свежих данных' (task, row, session), one millisecond less is 'в работе'; a negative age is zero; the age counts from the last event of the session, not from the start", () => {
  const lines = [
    lineAt("SessionStart", "S1", T0),
    lineAt("UserPromptSubmit", "S1", T0 + 500),
    sub("S1", "a1", T0 + 1000),
  ];
  const last = T0 + 1000;
  const at_ = (now) => {
    const m = buildModel(lines, [], now);
    return {
      m,
      task: taskOf(m).state,
      row: m.mainRows[0].state,
      word: m.sessions[0].word,
    };
  };
  for (const [delta, want] of [
    [-1, "in_progress"],
    [0, "in_progress"],
    [1, "stale"],
    [2, "stale"],
  ]) {
    const r = at_(last + STALE_AFTER_MS + delta);
    assert.equal(r.task, want, `task at +${delta}`);
    assert.equal(r.row, want, `row at +${delta}`);
    assert.equal(r.word, want === "stale" ? "stale" : "running", `${delta}`);
    assert.equal(r.m.sessions[0].running, want !== "stale");
  }
  assert.equal(at_(last + STALE_AFTER_MS).m.tasks[0].age_ms, STALE_AFTER_MS);
  // the age is a function of two numbers
  assert.equal(ageOf(iso(T0), T0 + 5), 5);
  assert.equal(ageOf(iso(T0), T0 - 5), 0, "a negative age is zero");
  assert.equal(ageOf("not a time", T0), null);
  assert.equal(ageOf(iso(T0), Number.NaN), null);
});

test("FS-05: a negative age (the clock went back) is zero - 'в работе', 'Идёт', 'меньше минуты назад'; the order of the items is as it was", async () => {
  const entries = [
    lineAt("SessionStart", "S1", T0),
    lineAt("UserPromptSubmit", "S1", T0 + 1000),
    sub("S1", "a1", T0 + 2000),
  ];
  const now = T0 - 30_000;
  const m = buildModel(entries, [], now);
  assert.equal(taskOf(m).age_ms, 0);
  assert.equal(taskOf(m).state, "in_progress");
  assert.equal(m.mainRows[0].age_ms, 0);
  assert.equal(m.sessions[0].age_ms, 0);
  assert.deepEqual(
    m.list.map((i) => i.key),
    ["a1", "main:1"],
  );
  const page = await loaded(entries, [], { now });
  const card = page.el("tasks").byClass("session-card")[0];
  assert.equal(card.dataset.word, "running");
  assert.equal(card.byClass("age")[0].textContent, "меньше минуты назад");
  assert.ok(!page.text("tasks").includes("NaN"));
});

test("FS-05: a trusted line from the future (README limit 9) counts as fresh with age zero; the real lines after it are the ones marked 'не из хуков'; when the clock reaches it plus the threshold, the session is 'нет свежих данных'", async () => {
  const now = T0 + 1800 * 1000;
  const ahead = now + 2 * 3600 * 1000;
  const entries = [
    lineAt("SessionStart", "S1", T0),
    sub("S1", "a1", T0 + 1000),
    tool("S1", ahead, "tu-future"),
    tool("S1", now - 1000, "tu-real"),
  ];
  const m = buildModel(entries, [], now);
  assert.equal(m.marks[2], null, "the future line is not marked");
  assert.notEqual(m.marks[3], null, "the real line after it is marked");
  assert.equal(taskOf(m).state, "in_progress");
  assert.equal(taskOf(m).age_ms, 0);
  assert.equal(m.sessions[0].word, "running");
  const page = await loaded(entries, [], { now });
  const card = page.el("tasks").byClass("session-card")[0];
  assert.equal(card.byClass("age")[0].textContent, "меньше минуты назад");
  // the clock reaches the line and passes the threshold
  const later = buildModel(entries, [], ahead + STALE_AFTER_MS + 1);
  assert.equal(taskOf(later).state, "stale");
});

test("FS-05: a long task - two hours since its start, but an event of its session 5 minutes ago - is 'в работе'; the same for a row of the main session, then Stop; the age is not counted from the start", () => {
  const nowMs = T0 + 2 * 3600 * 1000;
  const entries = [
    lineAt("SessionStart", "S1", T0),
    lineAt("UserPromptSubmit", "S1", T0 + 500),
    sub("S1", "a1", T0 + 1000),
    tool("S1", nowMs - 5 * 60 * 1000, "tu-late"),
  ];
  const m = buildModel(entries, [], nowMs);
  assert.equal(taskOf(m).state, "in_progress");
  assert.equal(taskOf(m).age_ms, 5 * 60 * 1000);
  assert.equal(m.mainRows[0].state, "in_progress");
  assert.equal(m.mainRows[0].age_ms, 5 * 60 * 1000);
  const stopped = [...entries, stopAt(nowMs - 1000)];
  assert.equal(buildModel(stopped, [], nowMs).mainRows[0].state, "completed");
  // without the late event the same two hours are 'нет свежих данных'
  const silent = buildModel(entries.slice(0, 3), [], nowMs);
  assert.equal(taskOf(silent).state, "stale");
  assert.equal(silent.mainRows[0].state, "stale");
});

test("FS-05: a planned tick of the page clock without new lines changes the word; then PostToolUse of the session returns 'в работе', then SubagentStop gives the word of the one who finished; the journal is not touched", async () => {
  const entries = [
    lineAt("SessionStart", "S1", T0),
    lineAt("UserPromptSubmit", "S1", T0 + 500),
    sub("S1", "a1", T0 + 1000),
  ];
  const page = await loaded(entries, [], {
    now: T0 + 1000 + STALE_AFTER_MS - 3000,
  });
  const states = () =>
    Object.fromEntries(
      page.items().map((i) => [i.dataset.key, i.dataset.state]),
    );
  assert.deepEqual(states(), { a1: "in_progress", "main:1": "in_progress" });
  const array = page.app.getModel().entries;
  // REQ-042 criterion 2(g): a move into 'нет свежих данных' is not an event of
  // the journal - the journal of the model and the shown one stay as they were
  const journalBefore = JSON.stringify(page.app.getModel().journal);
  const rowsBefore = page.rows().map((r) => r.textContent);
  const metaBefore = page.text("journal-meta");
  assert.equal(page.app.getModel().journal.length, entries.length);
  const calls = page.server.calls.length;
  // 10 s later (REFRESH_MS): the threshold has been crossed, no line came
  await page.tick(10_000);
  assert.ok(page.server.calls.length > calls, "the page polled");
  assert.equal(page.server.entries.length, entries.length, "no new lines");
  assert.equal(page.app.getModel().entries, array);
  assert.deepEqual(states(), { a1: "stale", "main:1": "stale" });
  assert.equal(
    page.el("tasks").byClass("session-card")[0].dataset.word,
    "stale",
  );
  assert.equal(page.app.getModel().journal.length, entries.length);
  assert.equal(JSON.stringify(page.app.getModel().journal), journalBefore);
  assert.deepEqual(
    page.rows().map((r) => r.textContent),
    rowsBefore,
    "the shown journal has the same rows",
  );
  assert.equal(page.text("journal-meta"), metaBefore);
  // PostToolUse of the same session
  page.server.entries.push(tool("S1", page.clock.now(), "tu-back"));
  await page.tick(2000);
  assert.deepEqual(states(), { a1: "in_progress", "main:1": "in_progress" });
  // SubagentStop, then Stop
  page.server.entries.push(subEnd("S1", "a1", page.clock.now()));
  page.server.entries.push(stopAt(page.clock.now()));
  await page.tick(2000);
  assert.deepEqual(states(), { a1: "completed", "main:1": "completed" });
  // and 'нет свежих данных' again does not touch a finished one
  await page.tick(STALE_AFTER_MS + 20_000);
  assert.deepEqual(states(), { a1: "completed", "main:1": "completed" });
});

// ------------------------------------------------------------------ FS-06

const SHAPES = /NaN|undefined|Invalid/;

test("FS-06: a time of the last event that cannot be read - 'нет свежих данных' without age, no NaN anywhere, no exception; the rest of the journal is as it was", () => {
  const entries = [
    lineAt("SessionStart", "S1", T0),
    { ...lineAt("UserPromptSubmit", "S1", T0 + 500), time: "not a time" },
    { ...sub("S1", "a1", T0 + 1000), time: "yesterday" },
    // a second session, fine and fresh, must not be touched
    lineAt("SessionStart", "S2", T0 + 2000),
    sub("S2", "b1", T0 + 3000, "Plan"),
  ];
  const copy = JSON.parse(JSON.stringify(entries));
  const now = T0 + 4000;
  const m = buildModel(entries, [], now);
  assert.deepEqual(entries, copy, "the input is not changed");
  assertInvariant(m, "unreadable time");
  assert.equal(taskOf(m, "a1").state, "stale");
  assert.equal(taskOf(m, "a1").age_ms, null);
  assert.equal(m.mainRows[0].state, "stale");
  assert.equal(m.mainRows[0].age_ms, null);
  const s1 = m.sessions.find((s) => s.session_id === "S1");
  assert.equal(s1.word, "stale");
  assert.equal(s1.age_ms, null);
  assert.equal(s1.running, false);
  assert.equal(taskOf(m, "b1").state, "in_progress");
  assert.equal(m.unconfirmed.count, 2);
  assert.equal(m.unconfirmed.oldest_stale_age_ms, null);
  // every text that the panels build from this model
  const office = buildOffice(m);
  const texts = [
    nowLine(m).text,
    nowLine(m).title,
    JSON.stringify(taskPanel(m)),
    JSON.stringify(buildCard(m, office, "role:Explore")),
  ];
  for (const text of texts) {
    assert.doesNotMatch(text, SHAPES, text);
  }
  assert.equal(
    nowLine(m).title.includes("У самого старого"),
    false,
    "no age to name",
  );
  assert.equal(ageText(null), "");
  assert.equal(ageText(Number.NaN), "");
});

test("FS-06: a clock that cannot be read (NaN, undefined, Infinity, a string) makes every would-be 'в работе' a 'нет свежих данных'; finished, unrecorded and restarted stay", () => {
  const entries = [
    lineAt("SessionStart", "R", T0),
    sub("R", "run", T0 + 1000),
    sub("D", "done", T0 + 2000),
    subEnd("D", "done", T0 + 3000),
    sub("U", "unrec", T0 + 4000),
    lineAt("SessionEnd", "U", T0 + 5000),
    sub("X", "restart", T0 + 6000),
    lineAt("UserPromptSubmit", "R", T0 + 7000),
  ];
  const starts = [startRec(entries.length, T0 + 8000)];
  // the start record comes after all the lines: everything that was open is
  // 'restarted'; use a second journal for the fresh case below
  for (const bad of [Number.NaN, undefined, Infinity, "abc"]) {
    const m = buildModel(entries, starts, bad);
    assertInvariant(m, String(bad));
    assert.equal(taskOf(m, "done").state, "completed");
    assert.equal(taskOf(m, "unrec").state, "unrecorded");
    assert.equal(taskOf(m, "restart").state, "restarted");
    assert.equal(taskOf(m, "run").state, "restarted");
    const open = buildModel(entries, [], bad);
    assert.equal(taskOf(open, "run").state, "stale", String(bad));
    assert.equal(taskOf(open, "run").age_ms, null);
    assert.equal(open.mainRows[0].state, "stale");
    assert.equal(
      open.sessions.every((s) => s.running === false),
      true,
    );
    assert.equal(open.unconfirmed.oldest_stale_age_ms, null);
    assert.doesNotMatch(
      JSON.stringify(nowLine(open)) + JSON.stringify(taskPanel(open)),
      /NaN|undefined/,
    );
  }
});

test("FS-06: no connection (mode 'fail') - the header says so, the page keeps the data, and by the clock the items still become 'нет свежих данных'; the journal array and the number of starts are not touched", async () => {
  const entries = [
    lineAt("SessionStart", "S1", T0),
    sub("S1", "a1", T0 + 1000),
  ];
  const page = await loaded(entries, [startRec(0, T0 - 1000)], {
    now: T0 + 1000 + STALE_AFTER_MS - 5000,
  });
  const keep = page.app.getModel().entries;
  const snapshot = JSON.stringify(keep);
  const starts = page.app.getModel().serverStarts.length;
  assert.equal(page.items()[0].dataset.state, "in_progress");
  page.server.mode = "fail";
  await page.tick(2000);
  assert.equal(page.el("link").dataset.state, "down");
  assert.equal(page.items()[0].dataset.state, "in_progress");
  await page.tick(10_000);
  assert.equal(page.el("link").dataset.state, "down");
  assert.equal(page.items()[0].dataset.state, "stale");
  assert.equal(
    page.items()[0].byClass("item-state")[0].textContent,
    WORDS.stale,
  );
  assert.equal(page.app.getModel().entries, keep);
  assert.equal(JSON.stringify(keep), snapshot);
  assert.equal(page.app.getModel().serverStarts.length, starts);
  assert.ok(!page.text("tasks").includes("NaN"));
});

// ------------------------------------------------------------------ FS-12

// An independent statement of the rules of criteria 1, 2 and 6, written from
// their text (not from the code): lines in the order of the file, every line
// is a trusted one of a hook.
function oracle(entries, starts, now) {
  const count = entries.length;
  const usable = starts.filter(
    (s) => Number.isInteger(s.journal_lines) && s.journal_lines <= count,
  );
  const latest = Math.max(-1, ...usable.map((s) => s.journal_lines));
  const lastStart = usable.length === 0 ? 0 : usable.at(-1).journal_lines;
  const lastAt = new Map();
  const lastIdx = new Map();
  const lastKind = new Map();
  const sessionEnd = new Map();
  const tasks = new Map();
  const open = new Map();
  const rows = [];
  entries.forEach((e, i) => {
    const s = e.session_id;
    lastAt.set(s, Date.parse(e.time));
    lastIdx.set(s, i);
    lastKind.set(s, e.hook_event_name);
    if (e.hook_event_name === "SessionEnd") sessionEnd.set(s, i);
    if (e.hook_event_name === "SubagentStart") {
      tasks.set(e.agent_id, { session: s, start: i, stopped: false });
    }
    if (e.hook_event_name === "SubagentStop" && tasks.has(e.agent_id)) {
      tasks.get(e.agent_id).stopped = true;
    }
    if (["UserPromptSubmit", "SessionEnd"].includes(e.hook_event_name)) {
      if (open.has(s)) {
        open.get(s).state = "unrecorded";
        open.delete(s);
      }
    }
    if (e.hook_event_name === "UserPromptSubmit") {
      const row = { key: `main:${i}`, session: s, start: i, state: null };
      rows.push(row);
      open.set(s, row);
    }
    if (e.hook_event_name === "Stop" && open.has(s)) {
      open.get(s).state = "completed";
      open.delete(s);
    }
  });
  const fresh = (s) => Math.max(0, now - lastAt.get(s)) <= STALE_AFTER_MS;
  const out = { tasks: {}, rows: {}, words: {} };
  for (const [key, t] of tasks) {
    let state = "in_progress";
    if (t.stopped) state = "completed";
    else if (sessionEnd.get(t.session) > t.start) state = "unrecorded";
    else if (latest > t.start) state = "restarted";
    else if (!fresh(t.session)) state = "stale";
    out.tasks[key] = state;
  }
  for (const r of rows) {
    out.rows[r.key] =
      r.state ??
      (latest > r.start
        ? "restarted"
        : fresh(r.session)
          ? "in_progress"
          : "stale");
  }
  for (const [s, kind] of lastKind) {
    if (kind === "SessionEnd") out.words[s] = null;
    else if (!fresh(s)) out.words[s] = "stale";
    else out.words[s] = lastIdx.get(s) >= lastStart ? "running" : null;
  }
  return out;
}

test("FS-12: the restart is named directly - the seven cases of criterion 6 (and the SessionEnd BEFORE the start); the table of the reasons of closing holds on all of them", () => {
  const startOf = (...more) => [
    lineAt("SessionStart", "S1", T0),
    sub("S1", "a1", T0 + 1000),
    ...more,
  ];
  // (1) a start of a subagent, then a record of a server start
  let m = buildModel(startOf(), [startRec(2)], FAR);
  assert.equal(taskOf(m).state, "restarted");
  assertInvariant(m, "1");
  // (2) the same and SessionEnd of the session after the start
  m = buildModel(
    startOf(lineAt("SessionEnd", "S1", T0 + 2000)),
    [startRec(2)],
    FAR,
  );
  assert.equal(taskOf(m).state, "unrecorded");
  m = buildModel(
    startOf(lineAt("SessionEnd", "S1", T0 + 2000)),
    [startRec(3)],
    FAR,
  );
  assert.equal(taskOf(m).state, "unrecorded", "SessionEnd before the start");
  assertInvariant(m, "2");
  // (3) a request of the main session, a record of a server start, then Stop
  const asked = [lineAt("SessionStart", "S1", T0), prompt(T0 + 1000)];
  m = buildModel(asked, [startRec(2)], FAR);
  assert.equal(m.mainRows[0].state, "restarted");
  assert.equal(m.mainRows[0].closed_by, "server_start");
  m = buildModel([...asked, stopAt(FAR - 1000)], [startRec(2)], FAR);
  assert.equal(m.mainRows[0].state, "completed");
  assert.equal(m.mainRows[0].closed_by, "stop");
  assertInvariant(m, "3");
  // (4) a start of a subagent AFTER the record: in progress
  m = buildModel(
    [lineAt("SessionStart", "S1", T0), sub("S1", "a1", T0 + 1000)],
    [startRec(1)],
    T0 + 2000,
  );
  assert.equal(taskOf(m).state, "in_progress");
  assertInvariant(m, "4");
  // (4a) request, record, next request: the old row is 'окончание не записано'
  m = buildModel([...asked, prompt(T0 + 2000)], [startRec(2)], T0 + 3000);
  assert.deepEqual(
    m.mainRows.map((r) => [r.state, r.closed_by]),
    [
      ["unrecorded", "next_prompt"],
      ["in_progress", null],
    ],
  );
  // (4b) start, record, SubagentStop: the word of the one who finished
  m = buildModel(
    startOf(subEnd("S1", "a1", T0 + 2000)),
    [startRec(2)],
    T0 + 3000,
  );
  assert.equal(taskOf(m).state, "completed");
  assertInvariant(m, "4b");
  // a stale record (journal_lines above the number of lines) does not count
  m = buildModel(startOf(), [startRec(50)], T0 + 3000);
  assert.equal(taskOf(m).state, "in_progress");
  // the word is not a statement that the agent has stopped
  assert.doesNotMatch(WORDS.restarted, /остановлен|завис|упал/);
});

test("FS-12: 400 random journals against an independent statement of the rules - states of tasks and rows, the word of the session, the table of reasons, the age against the threshold", () => {
  const rand = rng(4242);
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const kinds = [
    "SessionStart",
    "UserPromptSubmit",
    "Stop",
    "SubagentStart",
    "SubagentStart",
    "SubagentStop",
    "SessionEnd",
    "PostToolUse",
  ];
  for (let round = 0; round < 400; round++) {
    const entries = [];
    let t = T0;
    const size = 3 + Math.floor(rand() * 14);
    for (let i = 0; i < size; i++) {
      t += 1000 + Math.floor(rand() * 2_400_000);
      const kind = pick(kinds);
      const session = pick(["S1", "S2"]);
      const agent = pick(["a1", "a2", "a3"]);
      if (kind === "SubagentStart") entries.push(sub(session, agent, t));
      else if (kind === "SubagentStop") entries.push(subEnd(session, agent, t));
      else if (kind === "PostToolUse") entries.push(tool(session, t, `tu${i}`));
      else entries.push(lineAt(kind, session, t));
    }
    const starts = [];
    for (let k = Math.floor(rand() * 3); k > 0; k--) {
      starts.push(startRec(Math.floor(rand() * (size + 3)), t));
    }
    const now = t - 30_000 + Math.floor(rand() * 8_000_000);
    const want = oracle(entries, starts, now);
    const m = buildModel(entries, starts, now);
    const where = `round ${round}`;
    assertInvariant(m, where);
    assert.deepEqual(
      Object.fromEntries(m.tasks.map((x) => [x.key, x.state])),
      want.tasks,
      where,
    );
    assert.deepEqual(
      Object.fromEntries(m.mainRows.map((x) => [x.key, x.state])),
      want.rows,
      where,
    );
    assert.deepEqual(
      Object.fromEntries(m.sessions.map((x) => [x.session_id, x.word])),
      want.words,
      where,
    );
  }
});

// ------------------------------------------------------------------ FS-14

const SAMPLES = [
  "events-stale.jsonl",
  "events-restart.jsonl",
  "events-fresh.jsonl",
];
const CLOCK_STALE = Date.parse("2026-09-20T12:35:00.000Z");
const CLOCK_SHORT = Date.parse("2026-09-20T10:04:00.000Z");
const RESTART_RECORD = { time: "2026-09-20T10:01:00.000Z", journal_lines: 2 };

test("FS-14: the sample files are invented and valid - 'sample-' in every line, no prompt_text, every description begins with 'Образец', every line passes checkLine in the canonical form, no records of server starts, the folder holds nothing else", () => {
  assert.deepEqual(
    fs.readdirSync(FIXTURES).sort(),
    [...SAMPLES].sort(),
    "only the three sample files",
  );
  const counts = {
    "events-stale.jsonl": 9,
    "events-restart.jsonl": 3,
    "events-fresh.jsonl": 3,
  };
  for (const name of SAMPLES) {
    const { text, lines, entries } = readFixture(name);
    assert.ok(text.endsWith("\n"), `${name}: ends with a newline`);
    assert.equal(lines.length, counts[name], name);
    // grep -vc 'sample-' -> 0; grep -c prompt_text -> 0
    assert.equal(lines.filter((l) => !l.includes("sample-")).length, 0, name);
    assert.equal(
      lines.filter((l) => l.includes("prompt_text")).length,
      0,
      name,
    );
    // the two counts of descriptions are equal
    const described = lines.filter((l) => /"description": ?"/.test(l)).length;
    const sampled = lines.filter((l) =>
      /"description": ?"Образец/.test(l),
    ).length;
    assert.equal(described, sampled, name);
    assert.ok(described >= 1, `${name}: has a description`);
    let previous = 0;
    entries.forEach((e, i) => {
      const checked = checkLine(e, true);
      assert.equal(checked.ok, true, `${name} line ${i}: ${checked.reason}`);
      assert.equal(
        JSON.stringify(checked.line),
        lines[i],
        `${name}: canonical`,
      );
      assert.equal(e.source, "REAL");
      assert.ok(e.session_id.startsWith("sample-"), name);
      if (e.agent_id !== undefined) assert.ok(e.agent_id.startsWith("sample-"));
      if (e.launched_agent_id !== undefined) {
        assert.ok(e.launched_agent_id.startsWith("sample-"));
        assert.ok(e.tool_use_id.startsWith("sample-tu"));
      }
      assert.equal(Object.hasOwn(e, "journal_lines"), false, "no start record");
      const ms = Date.parse(e.time);
      assert.ok(ms >= previous, `${name}: times do not go back`);
      previous = ms;
    });
  }
  // the expressions themselves: a line from a real journal is seen
  assert.equal(
    ['{"session_id":"S1"}'].filter((l) => !l.includes("sample-")).length,
    1,
  );
});

test("FS-14: the sample reproduces D1-D3 and D5 on the page with the clock and the start record given by the test, and the control stays 'в работе'", async () => {
  // D1, D2, D3: two sessions, one silent
  const stale = readFixture("events-stale.jsonl").entries;
  const page = await loaded(stale, [], { now: CLOCK_STALE });
  const m = page.app.getModel();
  assert.equal(taskOf(m, "sample-a1").state, "stale");
  assert.equal(taskOf(m, "sample-a1").age_ms, 2 * 3600000 + 34 * 60000 + 48000);
  assert.equal(taskOf(m, "sample-a2").state, "in_progress");
  assert.equal(taskOf(m, "sample-a3").state, "in_progress");
  const words = Object.fromEntries(
    m.sessions.map((s) => [s.session_id, s.word]),
  );
  assert.deepEqual(words, { "sample-s1": "stale", "sample-s2": "running" });
  assert.equal(m.sessions.filter((s) => s.running).length, 1);
  const states = Object.fromEntries(
    page.items().map((i) => [i.dataset.key, i.dataset.state]),
  );
  assert.equal(states["sample-a1"], "stale");
  const a1 = page.items().find((i) => i.dataset.key === "sample-a1");
  assert.equal(a1.byClass("age")[0].textContent, "2 ч 34 мин назад");
  // the Explore character (only sample-a1) is free; the others work
  const office = page.app.getOffice();
  const by = (key) => office.characters.find((c) => c.key === key);
  assert.equal(by("role:Explore").working, false);
  assert.equal(by("role:Plan").working, true);
  assert.equal(by("role:general-purpose").working, true);
  // D3: no bar and no 'n/m' on the cards
  const cards = page.el("tasks").byClass("session-card");
  assert.equal(cards.length, 2);
  for (const card of cards) {
    assert.equal(card.all((e) => e.tagName === "PROGRESS").length, 0);
    assert.doesNotMatch(card.textContent, /задач|ролей|\d+\/\d+/);
  }

  // D5: an agent started, then a record of a server start, a fresh event
  const restart = readFixture("events-restart.jsonl").entries;
  const p5 = await loaded(restart, [RESTART_RECORD], { now: CLOCK_SHORT });
  const m5 = p5.app.getModel();
  assert.equal(taskOf(m5, "sample-a4").state, "restarted");
  assert.equal(m5.sessions[0].running, true, "the session has a fresh event");
  assert.equal(m5.unconfirmed.count, 1);
  assert.equal(
    p5.text("now-text"),
    "Сейчас: в работе ничего нет · без свежих данных: 1",
  );
  assert.ok(p5.el("now").title.includes(fmtDateTime(RESTART_RECORD.time)));
  assert.match(p5.el("now").title, /Сервер перезапускался/);
  assert.doesNotMatch(p5.el("now").title, /Нет свежих данных/);
  const item = p5.items().find((i) => i.dataset.key === "sample-a4");
  assert.equal(item.byClass("item-state")[0].textContent, WORDS.restarted);
  assert.notEqual(item.dataset.state, "unrecorded");

  // the control: fresh events, no restart
  const fresh = readFixture("events-fresh.jsonl").entries;
  const pc = await loaded(fresh, [], { now: CLOCK_SHORT });
  assert.equal(taskOf(pc.app.getModel(), "sample-a5").state, "in_progress");
  assert.equal(pc.app.getModel().unconfirmed.count, 0);
  assert.ok(
    pc.text("now-text").startsWith("Сейчас: Plan"),
    pc.text("now-text"),
  );
});

// ------------------------------------------------------------------ FS-15

test("FS-15: only truth - no 'завис', 'остановлен', 'упал' in texts.js; the page sends only GET; text from the journal on 'нет свежих данных' and 'сервер перезапускался' is text, never an element", async () => {
  const texts = fs.readFileSync(path.join(PUBLIC, "texts.js"), "utf8");
  assert.deepEqual(
    texts.split("\n").filter((l) => /завис|остановлен|упал/.test(l)),
    [],
  );
  assert.equal(grepPublic(/method *: *['"](POST|PUT|PATCH|DELETE)/).length, 0);
  // the hostile text is the role and the description of both unconfirmed kinds
  const entries = [
    lineAt("SessionStart", "S1", T0),
    lineAt("PostToolUse", "S1", T0 + 500, {
      tool_use_id: "tu1",
      launched_agent_id: "a1",
      subagent_type: IMG,
      description: IMG,
    }),
    sub("S1", "a1", T0 + 1000, IMG),
    lineAt("SessionStart", "S2", T0 + 2000),
    lineAt("PostToolUse", "S2", T0 + 2500, {
      tool_use_id: "tu2",
      launched_agent_id: "a2",
      subagent_type: IMG,
      description: IMG,
    }),
    sub("S2", "a2", T0 + 3000, IMG),
  ];
  // the record stands after the first three lines: a1 is restarted, a2 is
  // started later and is only silent
  const page = await loaded(entries, [startRec(3, T0 + 1500)], { now: FAR });
  const states = Object.fromEntries(
    page.items().map((i) => [i.dataset.key, i.dataset.state]),
  );
  assert.equal(states.a1, "restarted");
  assert.equal(states.a2, "stale");
  assert.equal(page.created("img").length, 0, "no element was made");
  assert.equal(page.doc.htmlWrites, 0);
  assert.ok(withText(page.el("tasks"), IMG).length >= 2);
  assert.equal(page.el("tasks").all((e) => e.tagName === "IMG").length, 0);
  // the explanation line and the title carry no text of the journal
  assert.ok(!page.el("now").title.includes("img"));
  assert.ok(!page.text("now-text").includes("img"));
  // only GET went out
  assert.ok(page.server.calls.length >= 1);
  for (const c of page.server.calls) assert.equal(c.init.method, "GET");
});

// ------------------------------------------------------------------ FS-18

test("FS-18: the page clock is the only source of 'now' - no read of the real clock in model.js, panels.js, office-model.js, history.js, format.js, texts.js, schema.js, app.js", () => {
  const CLOCK = /Date\.now|new Date\(\)|performance\.now/;
  for (const name of [
    "model.js",
    "panels.js",
    "office-model.js",
    "history.js",
    "format.js",
    "texts.js",
    "schema.js",
    "app.js",
  ]) {
    const lines = fs
      .readFileSync(path.join(PUBLIC, name), "utf8")
      .split("\n")
      .filter((l) => CLOCK.test(l));
    assert.deepEqual(lines, [], name);
  }
  // the expression sees the clock and lets a dated copy pass
  assert.equal(CLOCK.test("const t = Date.now();"), true);
  assert.equal(CLOCK.test("const d = new Date();"), true);
  assert.equal(CLOCK.test("new Date(t).toISOString()"), false);
  // the only clocks that remain are in boot.js (the page) and the default
  // parameter of the report command
  assert.ok(
    /Date\.now/.test(fs.readFileSync(path.join(PUBLIC, "boot.js"), "utf8")),
  );
});

// ===================================================================
// REQ-036, REQ-045, REQ-044 (design docs/design/REQ-036-044-045-interactive.md,
// table 9): the journal in plain words, the details of an event, the card of
// one instance of an agent. Literals of the criteria are written here.
// ===================================================================
import { mock } from "node:test";
import { tzLabel } from "../src/pixel-office/public/format.js";
import { eventDetails } from "../src/pixel-office/public/event-details.js";
import { buildInstanceCard } from "../src/pixel-office/public/instance-card.js";
import { roleName } from "../src/pixel-office/public/words.js";
import {
  cssDecls,
  parseCss,
  runHook,
  settle,
  startServer,
} from "./pixel-office-helpers.js";

const SERVICE = /undefined|null|NaN|\[object/;
const S = (n) => T0 + n * 1000;
const ORCH_ROLE = "Sai Orchestrator (ORCH)";

// A press of a key on an element, as a browser does it (the helper activates
// a button or a summary on Enter and Space unless a listener prevents it).
const press = (el, key, extra = {}) => el.fire("keydown", { key, ...extra });
const focused = (page) => page.doc.focused;
const rowAt = (page, index) =>
  page.rows().find((r) => r.dataset.index === String(index));
const toggleAt = (page, index) => rowAt(page, index).byClass("row-toggle")[0];
const detailsAt = (page, index) =>
  rowAt(page, index)?.byClass("event-details")[0] ?? null;
const field = (box, name) => box.find((e) => e.dataset.field === name);
const valueOf = (box, name) =>
  field(box, name)?.byClass("detail-value")[0]?.textContent ?? null;

// A click on a point of the canvas given in logical pixels of the office (with
// min_x), as the office test does it.
function clickPoint(page, px, py) {
  const office = page.app.getOffice();
  page.canvas.rect = {
    left: 0,
    top: 0,
    width: office.layout.width * 24,
    height: office.layout.height * 24,
  };
  page.canvas.click({
    clientX: px - office.layout.min_x * 24,
    clientY: py,
  });
}
const deskOf = (page, key) => {
  const o = page.app.getOffice();
  const c = o.characters.find((x) => x.key === key);
  return o.layout.desks[c.desk_index];
};
const legendOf = (page, key) =>
  page.legend().find((b) => b.dataset.key === key);
const cardEl = (page) => page.el("card");
const cardOpen = (page) => page.el("card-overlay").hidden === false;
const cardId = (page) => cardEl(page).byClass("card-id")[0]?.textContent;

// ------------------------------------------------------------------ NM-06

test("NM-06: what reaches the block 'Сейчас' through the real path hook -> server -> page is text - a description with <script> is shown literally and makes no element; the code of the page has no way to markup", async (t) => {
  const srv = await startServer(t);
  const description = "<script>alert(1)</script> и обычные слова";
  const input = {
    session_id: "nm06-session",
    hook_event_name: "PostToolUse",
    tool_name: "Agent",
    tool_use_id: "toolu_nm06",
    tool_input: { subagent_type: "Plan", description, prompt: "не нужен" },
    tool_response: { agentId: "agent-nm06" },
  };
  const start = {
    session_id: "nm06-session",
    hook_event_name: "SubagentStart",
    agent_id: "agent-nm06",
    agent_type: "Plan",
  };
  for (const [event, body] of [
    ["PostToolUse", input],
    ["SubagentStart", start],
  ]) {
    const r = await runHook(srv.box, body, { event });
    assert.equal(r.code, 0, r.stderr);
  }
  const answer = await srv.get("/api/events?after=0");
  const body = JSON.parse(answer.body);
  assert.equal(body.events.length, 2);
  const page = makePage({
    entries: body.events,
    now: Date.parse(body.events[1].time) + 1000,
  });
  await page.start();
  const rows = page.el("now").all((e) => e.classes.has("now-row"));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].textContent, `Plan — ${description}`);
  assert.equal(page.created("script").length, 0);
  assert.equal(page.doc.htmlWrites, 0);
  const sinks = /innerHTML|outerHTML|insertAdjacentHTML|document\.write/;
  for (const name of fs.readdirSync(PUBLIC)) {
    const text = fs.readFileSync(path.join(PUBLIC, name), "utf8");
    assert.equal(sinks.test(text), false, name);
  }
});

test("NM-06: a secret in the description and the role goes the real path hook -> server -> page and is nowhere - not in the file of the journal, not in the answer of the server, not in the text of 'Сейчас', the journal, the details and the card; '[скрыто]' stands in its place", async (t) => {
  // invented secrets, put together at run time
  const key = ["sk", "ant", "NM06fakeKEY0123456789abcdefQ"].join("-");
  const pass = ["nm06", "pass", "VALUE42zz"].join("");
  const leaks = (text, secret) => {
    for (let i = 0; i + 8 <= secret.length; i++) {
      if (text.includes(secret.slice(i, i + 8))) return secret.slice(i, i + 8);
    }
    return null;
  };
  const srv = await startServer(t);
  const role = `Plan ${key}`;
  const inputs = [
    [
      "PostToolUse",
      {
        session_id: "nm06-secret",
        hook_event_name: "PostToolUse",
        tool_name: "Agent",
        tool_use_id: "toolu_nm06s",
        tool_input: {
          subagent_type: role,
          description: `ключ ${key} и password="${pass}"`,
        },
        tool_response: { agentId: "agent-nm06s" },
      },
    ],
    [
      "SubagentStart",
      {
        session_id: "nm06-secret",
        hook_event_name: "SubagentStart",
        agent_id: "agent-nm06s",
        agent_type: role,
      },
    ],
  ];
  for (const [event, body] of inputs) {
    const r = await runHook(srv.box, body, { event });
    assert.equal(r.code, 0, r.stderr);
  }
  const file = fs.readFileSync(srv.eventsFile, "utf8");
  const answer = (await srv.get("/api/events?after=0")).body;
  for (const [where, text] of [
    ["file", file],
    ["answer", answer],
  ]) {
    assert.equal(leaks(text, key), null, `${where}: ${leaks(text, key)}`);
    assert.equal(leaks(text, pass), null, `${where}: ${leaks(text, pass)}`);
    assert.ok(text.includes("[скрыто]"), where);
  }
  const events = JSON.parse(answer).events;
  assert.equal(events.length, 2);
  const page = makePage({
    entries: events,
    now: Date.parse(events[1].time) + 1000,
  });
  await page.start();
  const texts = [page.text("now"), page.el("now").title, page.text("journal")];
  for (let i = 0; i < events.length; i++) {
    toggleAt(page, i).click();
    const box = detailsAt(page, i);
    for (const part of box.all((e) => e.tagName === "DETAILS"))
      part.open = true;
    texts.push(box.textContent);
  }
  legendOf(page, "role:Plan [скрыто]").click();
  for (const part of cardEl(page).all((e) => e.tagName === "DETAILS")) {
    part.open = true;
  }
  texts.push(cardEl(page).textContent);
  for (const text of texts) {
    assert.equal(leaks(text, key), null, text);
    assert.equal(leaks(text, pass), null, text);
  }
  const row = page.el("now").all((e) => e.classes.has("now-row"))[0];
  assert.equal(
    row.textContent,
    "Plan [скрыто] — ключ [скрыто] и password=[скрыто]",
  );
  assert.ok(cardEl(page).textContent.includes("[скрыто]"));
});

// ------------------------------------------------------------------ JR-03

// One line of each case with the tasks and rows they name (design 4.2).
function detailsJournal() {
  const plan = "Plan";
  const entries = [
    lineAt("SessionStart", "S1", S(1)), // 0
    lineAt("UserPromptSubmit", "S1", S(2), {
      prompt_kind: "owner",
      prompt_text: "СКРЫТЫЙ-ТЕКСТ-JR03",
    }), // 1
    lineAt("UserPromptSubmit", "S1", S(3), { prompt_kind: "service" }), // 2
    lineAt("UserPromptSubmit", "S1", S(4)), // 3
    lineAt("PostToolUse", "S1", S(5), {
      tool_use_id: "tu1",
      launched_agent_id: "agent-a1-long",
      subagent_type: plan,
      description: "проект",
    }), // 4
    sub("S1", "agent-a1-long", S(6), plan), // 5
    subEnd("S1", "agent-a1-long", S(7), plan), // 6
    sub("S1", "agent-a1-long", S(8), plan), // 7
    {
      time: iso(S(9)),
      source: "ORCH",
      session_id: "S1",
      req_id: "REQ-045",
      request_time: iso(S(2)),
      note_text: "как понял: образец",
    }, // 8
    lineAt("Stop", "S1", S(10)), // 9
    lineAt("PostToolUse", "S1", S(11), {
      tool_use_id: "tu2",
      launched_agent_id: "nobody-here",
      subagent_type: plan,
    }), // 10
    subEnd("S1", "ghost-agent", S(12), plan), // 11
    lineAt("Stop", "S3", S(13)), // 12: no row of S3
    { ...lineAt("Stop", "S1", S(14)), source: "SIMULATION" }, // 13
    lineAt("SessionEnd", "S5", S(15)), // 14
  ];
  return entries;
}

test("JR-03: the details of a row - the fields of each case (when, source, session, agent, the task as it is now, what happened, what it does not prove, the mark, the technical fields without prompt_text); Enter and Space open, Escape and 'Закрыть' close with the focus on the row; the button of the window opens the window and gets the focus back; after a new line the details, their open part and the focus stay", async () => {
  const entries = detailsJournal();
  const page = await loaded(entries, [], { now: S(20) });
  const m = page.app.getModel();
  const h = buildHistory(m);
  // the model of the details, case by case (design 3.4, 4.2)
  const d = (i) => eventDetails(m, h, i);
  const tasks = (i) => [d(i).task.text, d(i).task.state];
  assert.deepEqual(tasks(0), ["к задаче не относится", null]);
  assert.deepEqual(tasks(1), ["Основная сессия", "unrecorded"]);
  assert.deepEqual(tasks(2), ["Основная сессия", "unrecorded"]);
  assert.deepEqual(tasks(3), ["Основная сессия", "completed"]);
  assert.deepEqual(
    tasks(4),
    ["Plan · agent-a1", "in_progress"],
    "the task of the launched one",
  );
  assert.deepEqual(tasks(5), ["Plan · agent-a1", "in_progress"]);
  assert.deepEqual(tasks(6), ["Plan · agent-a1", "in_progress"]);
  assert.deepEqual(
    tasks(8),
    ["Основная сессия", "unrecorded"],
    "the row of its request",
  );
  assert.deepEqual(tasks(9), ["Основная сессия", "completed"]);
  assert.deepEqual(tasks(10), [
    "задача не найдена: её начало не записано",
    null,
  ]);
  assert.deepEqual(tasks(11), [
    "задача не найдена: её начало не записано",
    null,
  ]);
  assert.deepEqual(tasks(12), [
    "строка основной сессии не найдена: запрос этой сессии не записан",
    null,
  ]);
  assert.deepEqual(tasks(13), ["к задаче не относится", null], "a marked line");
  assert.deepEqual(tasks(14), ["к задаче не относится", null]);
  assert.equal(d(0).source, "хук Claude Code");
  assert.equal(d(8).source, "запись оркестратора");
  assert.equal(d(13).source, "другой источник: SIMULATION");
  assert.equal(d(0).agent, "основная сессия: у этого события агента нет");
  assert.equal(d(4).agent, "основная сессия: у этого события агента нет");
  assert.equal(d(5).agent, "Plan · agent-a1");
  assert.equal(d(8).agent, "оркестратор");
  assert.equal(d(0).when, `${fmtDateTime(iso(S(1)))} · ${tzLabel()}`);
  assert.deepEqual(d(0).session, { short: "S1", full: "S1" });
  assert.equal(d(7).words, "Агент «Plan» продолжил работу");
  assert.equal(d(13).meaning, TX.EVENT_TABLE.marked.meaning);
  assert.equal(
    d(13).mark,
    "не из хуков: источник строки — не хук Claude Code: SIMULATION",
  );
  assert.deepEqual(d(8).note, {
    text: "как понял: образец",
    req_id: "REQ-045",
    request_time: iso(S(2)),
    auto: false,
  });
  // prompt_text never shows, not even among the technical fields
  assert.deepEqual(
    d(1).tech.map(([k]) => k),
    ["time", "source", "hook_event_name", "session_id", "prompt_kind"],
  );
  for (let i = 0; i < entries.length; i++) {
    assert.equal(JSON.stringify(d(i)).includes("СКРЫТЫЙ-ТЕКСТ-JR03"), false, i);
  }

  // the page: Enter opens, the focus stays on the row
  const toggle = toggleAt(page, 5);
  assert.equal(toggle.tagName, "BUTTON");
  assert.equal(toggle.getAttribute("type"), "button");
  assert.equal(toggle.getAttribute("aria-expanded"), "false");
  assert.equal(toggle.getAttribute("aria-controls"), "event-5");
  toggle.focus();
  press(toggle, "Enter");
  let box = detailsAt(page, 5);
  assert.ok(box !== null);
  assert.equal(box.getAttribute("id"), "event-5");
  assert.equal(toggleAt(page, 5).getAttribute("aria-expanded"), "true");
  assert.ok(focused(page) === toggleAt(page, 5));
  assert.equal(valueOf(box, "agent"), "Plan · agent-a1");
  assert.equal(
    field(box, "task").byClass("state-badge")[0].textContent,
    "в работе",
  );
  assert.ok(valueOf(box, "task") === "Plan · agent-a1 · сейчас: в работе");
  assert.equal(
    valueOf(box, "not_proved"),
    TX.EVENT_TABLE.agent_start.not_proved,
  );
  // Escape inside the row closes, the focus is on the toggle
  press(rowAt(page, 5), "Escape");
  assert.equal(detailsAt(page, 5), null);
  assert.ok(focused(page) === toggleAt(page, 5));
  // Escape with the focus inside the details (on their technical fields):
  // closed, the focus goes to the toggle of the row
  press(toggleAt(page, 5), "Enter");
  const inner = detailsAt(page, 5).find((e) => e.dataset.part === "tech")
    .children[0];
  inner.focus();
  press(rowAt(page, 5), "Escape");
  assert.equal(detailsAt(page, 5), null);
  assert.ok(focused(page) === toggleAt(page, 5));
  // Space opens; "Закрыть" closes with the same focus
  press(toggleAt(page, 5), " ");
  box = detailsAt(page, 5);
  box.byClass("details-close")[0].click();
  assert.equal(detailsAt(page, 5), null);
  assert.ok(focused(page) === toggleAt(page, 5));
  // only one row is open at a time
  toggleAt(page, 1).click();
  toggleAt(page, 4).click();
  assert.equal(page.el("journal").byClass("event-details").length, 1);
  assert.ok(detailsAt(page, 4) !== null);
  // the request of the owner: no text anywhere in the details
  toggleAt(page, 1).click();
  box = detailsAt(page, 1);
  assert.equal(box.textContent.includes("СКРЫТЫЙ-ТЕКСТ-JR03"), false);
  assert.equal(page.text("journal").includes("СКРЫТЫЙ-ТЕКСТ-JR03"), false);
  // the button of the window: a press and Enter open it; the focus comes back
  const opener = () => rowAt(page, 1).byClass("history-open")[0];
  opener().click();
  const dom = historyDom(page);
  assert.equal(dom.isOpen(), true);
  dom.close.click();
  assert.ok(focused(page) === opener());
  press(opener(), "Enter");
  assert.equal(dom.isOpen(), true);
  page.doc.fire("keydown", { key: "Escape", preventDefault() {} });
  assert.ok(focused(page) === opener());
  // open the details, open the technical fields, put the focus on them; a
  // new line and the planned recalculation keep all three
  toggleAt(page, 7).click();
  const tech = () => detailsAt(page, 7).find((e) => e.dataset.part === "tech");
  const summary = tech().children[0];
  assert.equal(summary.tagName, "SUMMARY");
  summary.click();
  assert.equal(tech().open, true);
  summary.focus();
  page.server.entries.push(lineAt("Stop", "S9", S(21)));
  await page.tick(2000);
  await page.tick(10_000);
  assert.ok(detailsAt(page, 7) !== null, "the details stay open");
  assert.equal(tech().open, true, "the technical fields stay open");
  assert.ok(
    focused(page) === tech().children[0],
    "the same element has the focus",
  );
  assert.equal(
    tech()
      .byClass("tech-key")
      .map((e) => e.textContent)
      .join(""),
    "time: source: hook_event_name: session_id: agent_id: agent_type: ",
  );
});

// ------------------------------------------------------------------ JR-05

test("JR-05: a hostile text is text in the row and in the details - an <img onerror> and a <script> in the role, the description, the identifiers, the text of a record and the technical fields create no element and run nothing; '$&' in the role and the source stays literal; only GET", async () => {
  const IMGX = "<img src=x onerror=alert(1)>";
  const SCRIPT = "<script>window.__x=1</script>";
  const entries = [
    lineAt("SessionStart", IMGX, S(1)),
    lineAt("PostToolUse", IMGX, S(2), {
      tool_use_id: SCRIPT,
      launched_agent_id: IMGX,
      subagent_type: SCRIPT,
      description: IMGX,
    }),
    sub(IMGX, IMGX, S(3), SCRIPT),
    sub(IMGX, "x$&", S(4), "$&"),
    {
      time: iso(S(5)),
      source: "ORCH",
      req_id: "REQ-045",
      note_text: `${SCRIPT} ${IMGX}`,
    },
    { ...lineAt("Stop", "S1", S(6)), source: "$&" },
  ];
  const page = await loaded(entries, [], { now: S(10) });
  assert.equal(page.rows().length, entries.length);
  // every row opened, its technical fields too, one after the other
  for (let i = 0; i < entries.length; i++) {
    toggleAt(page, i).click();
    const tech = detailsAt(page, i).find((e) => e.dataset.part === "tech");
    tech.children[0].click();
    assert.equal(tech.open, true);
    assert.equal(page.created("img").length, 0, `row ${i}`);
    assert.equal(page.created("script").length, 0, `row ${i}`);
    toggleAt(page, i).click();
  }
  assert.equal(page.created("img").length, 0);
  assert.equal(page.created("script").length, 0);
  assert.equal(page.doc.htmlWrites, 0);
  assert.equal(globalThis.__x, undefined);
  assert.equal(
    rowAt(page, 2).byClass("event")[0].textContent,
    `Агент «${SCRIPT}» получил задание и начал работу`,
  );
  assert.equal(
    rowAt(page, 3).byClass("event")[0].textContent,
    "Агент «$&» получил задание и начал работу",
  );
  assert.equal(rowAt(page, 1).byClass("row-desc")[0].textContent, IMGX);
  toggleAt(page, 5).click();
  assert.equal(
    valueOf(detailsAt(page, 5), "mark"),
    "не из хуков: источник строки — не хук Claude Code: $&",
  );
  toggleAt(page, 4).click();
  assert.equal(valueOf(detailsAt(page, 4), "note_text"), `${SCRIPT} ${IMGX}`);
  toggleAt(page, 2).click();
  assert.ok(
    detailsAt(page, 2)
      .byClass("tech-value")
      .some((e) => e.textContent === IMGX),
  );
  for (const c of page.server.calls) assert.equal(c.init.method, "GET");
});

// ------------------------------------------------------------------ JR-06

test("JR-06: bad data does not break the journal - an empty journal keeps its texts; a row of the main session has who 'Основная сессия'; an empty role is '(роль не указана)'; an unreadable time is 'время не записано'; an agent without a task, a record without a session and a time of request, identifiers of 128 characters, a lost link with open details - no exception, no service word", async () => {
  const errors = mock.method(console, "error", () => {});
  try {
    const empty = await loaded([], [], { now: S(10) });
    assert.equal(
      empty.text("journal").includes("Событий от хуков пока нет"),
      true,
    );
    const long = "z".repeat(128);
    const entries = [
      lineAt("SessionStart", "S1", S(1)),
      lineAt("UserPromptSubmit", "S1", S(2)),
      lineAt("SubagentStart", "S1", S(3), {
        agent_id: "noroll",
        agent_type: "",
      }),
      // no subagent_type at all (an empty one is not a valid line)
      lineAt("PostToolUse", "S1", S(4), {
        tool_use_id: "tu",
        launched_agent_id: "x",
      }),
      subEnd("S1", "ghost", S(5), "Plan"),
      {
        time: iso(S(6)),
        source: "ORCH",
        req_id: "REQ-045",
        note_text: "без сессии",
      },
      sub(long, long, S(7), "Plan"),
    ];
    const page = await loaded(entries, [], { now: S(10) });
    const who = (i) => rowAt(page, i).byClass("who")[0].textContent;
    assert.equal(who(1), "Основная сессия");
    assert.equal(who(2), "(роль не указана)");
    assert.equal(
      rowAt(page, 2).byClass("event")[0].textContent,
      "Агент «(роль не указана)» получил задание и начал работу",
    );
    assert.equal(
      rowAt(page, 3).byClass("event")[0].textContent,
      "Задание передано агенту «(роль не указана)»",
    );
    assert.equal(
      rowAt(page, 5).byClass("session")[0].textContent,
      "сессия не указана",
    );
    assert.equal(
      rowAt(page, 6).byClass("session")[0].textContent,
      "z".repeat(8),
    );
    for (let i = 0; i < entries.length; i++) toggleAt(page, i).click();
    toggleAt(page, 5).click();
    assert.equal(field(detailsAt(page, 5), "request_time"), null);
    assert.equal(valueOf(detailsAt(page, 5), "session"), "сессия не указана");
    toggleAt(page, 4).click();
    assert.equal(
      field(detailsAt(page, 4), "task").textContent.includes(
        "задача не найдена",
      ),
      true,
    );
    toggleAt(page, 6).click();
    assert.equal(
      detailsAt(page, 6)
        .find((e) => e.dataset.part === "session")
        .byClass("full-id")[0].textContent,
      long,
    );
    // the link is lost while the details are open
    page.server.mode = "fail";
    await page.tick(2000);
    await page.tick(10_000);
    assert.ok(detailsAt(page, 6) !== null);
    assert.doesNotMatch(page.text("journal"), SERVICE);
    // an unreadable time: the row and "Когда" say so (the reading of the page
    // drops such a line, the model of the details is checked directly)
    const bad = [{ ...lineAt("SessionStart", "S1", S(1)), time: "не время" }];
    const mb = buildModel(bad, [], S(10));
    assert.equal(
      eventDetails(mb, buildHistory(mb), 0).when,
      "время не записано",
    );
    assert.equal(fmtTimeSec("не время"), "");
    assert.equal(errors.mock.calls.length, 0, "reportOnce was not called");
  } finally {
    errors.mock.restore();
  }
});

// ------------------------------------------------------------------ AC-02

test("AC-02: a press on the middle of the desk of a role with two instances opens the instance first in the list (the one in work, started earlier), the same as a press on the character; the desk of the main session opens the card of the main session; the title is the name in plain words", async () => {
  const entries = [
    lineAt("SessionStart", "S1", S(1)),
    sub("S1", "A1-first-in-work", S(2), ORCH_ROLE),
    sub("S1", "A2-later-finished", S(3), ORCH_ROLE),
    subEnd("S1", "A2-later-finished", S(4), ORCH_ROLE),
  ];
  const page = await loaded(entries, [], { now: S(10) });
  const desk = deskOf(page, `role:${ORCH_ROLE}`);
  const [bx, by] = desk.block;
  // the middle of the 2 x 2 block of the desk
  clickPoint(page, (bx + 1) * 24, (by + 1) * 24);
  assert.equal(cardOpen(page), true);
  assert.equal(cardId(page), "A1-first");
  assert.equal(
    cardEl(page).byClass("card-title")[0].textContent,
    roleName(ORCH_ROLE),
  );
  assert.equal(roleName(ORCH_ROLE), "Оркестратор");
  assert.equal(cardEl(page).dataset.kind, "instance");
  cardEl(page).byClass("card-close")[0].click();
  // the character itself
  const pos = page.app
    .getSim()
    .positions()
    .find((p) => p.key === `role:${ORCH_ROLE}`);
  clickPoint(page, (pos.x + 0.5) * 24, (pos.y + 0.5) * 24);
  assert.equal(cardId(page), "A1-first");
  cardEl(page).byClass("card-close")[0].click();
  // the desk of the main session: the card of the main session as before
  const main = deskOf(page, "main");
  clickPoint(page, (main.block[0] + 1) * 24, (main.block[1] + 1) * 24);
  assert.equal(cardEl(page).dataset.kind, "main");
  assert.equal(
    cardEl(page).byClass("card-working")[0].textContent,
    "идущих сессий: 1",
  );
  // the default instance is the first of the list (rule d), not the last
  assert.equal(
    buildInstanceCard(
      page.app.getModel(),
      page.app.getOffice(),
      "A1-first-in-work",
    ).instances.shown[0].key,
    "A1-first-in-work",
  );
});

// ------------------------------------------------------------------ AC-03

test("AC-03: the keyboard - Enter and Space on a legend button open the card; Escape gives the focus to the legend button of that role (also after a press on the canvas); Tab and Shift+Tab go round the controls of the card and skip the inside of a closed <details>; after a link to role B Escape gives the focus to the legend button of B; with no legend button the focus goes to the area of the office; the focus rings are in the CSS", async () => {
  const entries = [
    lineAt("SessionStart", "S1", S(1)),
    lineAt("PostToolUse", "S1", S(2), {
      tool_use_id: "tuA",
      launched_agent_id: "agentA",
      subagent_type: "Plan",
    }),
    sub("S1", "agentA", S(3), "Plan"),
    lineAt("PostToolUse", "S1", S(4), {
      tool_use_id: "tuB",
      launched_agent_id: "agentB",
      subagent_type: "Explore",
      agent_id: "agentA",
      agent_type: "Plan",
    }),
    sub("S1", "agentB", S(5), "Explore"),
  ];
  const page = await loaded(entries, [], { now: S(10) });
  const plan = () => legendOf(page, "role:Plan");
  press(plan(), "Enter");
  assert.equal(cardOpen(page), true);
  assert.equal(cardId(page), "agentA");
  assert.ok(focused(page) === cardEl(page).byClass("card-close")[0]);
  page.doc.fire("keydown", { key: "Escape", preventDefault() {} });
  assert.equal(cardOpen(page), false);
  assert.ok(focused(page) === plan(), "the legend button of the role");
  press(plan(), " ");
  assert.equal(cardOpen(page), true);
  // Tab goes round: the controls in the order of the tree, a closed details
  // gives only its summary
  const controls = () =>
    cardEl(page).all(
      (e) =>
        (e.tagName === "BUTTON" || e.tagName === "SUMMARY") &&
        !e.ancestorsClosed,
    );
  const visible = [];
  const walk = (node) => {
    for (const child of node.children) {
      if (child.tagName === "BUTTON" || child.tagName === "SUMMARY") {
        visible.push(child);
        continue;
      }
      if (child.tagName === "DETAILS" && child.open !== true) {
        visible.push(child.children.find((c) => c.tagName === "SUMMARY"));
        continue;
      }
      walk(child);
    }
  };
  walk(cardEl(page));
  assert.ok(visible.length >= 6);
  assert.ok(controls().length > visible.length, "closed details hide buttons");
  const tab = (shiftKey = false) =>
    page.doc.fire("keydown", { key: "Tab", shiftKey, preventDefault() {} });
  assert.ok(focused(page) === visible[0], "the cross first");
  for (let i = 1; i < visible.length; i++) {
    tab();
    assert.ok(focused(page) === visible[i], `Tab ${i}`);
  }
  tab();
  assert.ok(focused(page) === visible[0], "round to the cross");
  tab(true);
  assert.ok(
    focused(page) === visible[visible.length - 1],
    "Shift+Tab: the last",
  );
  // the link to B (in "Кого запустил"), then Escape: the legend button of B
  const launched = cardEl(page).find((e) => e.dataset.part === "launched");
  launched.children[0].click();
  assert.equal(launched.open, true);
  cardEl(page)
    .find((e) => e.dataset.part === "launched")
    .find((e) => e.dataset.focus === "launched:agentB")
    .click();
  assert.equal(cardId(page), "agentB");
  page.doc.fire("keydown", { key: "Escape", preventDefault() {} });
  assert.ok(focused(page) === legendOf(page, "role:Explore"));
  // opened from the canvas: Escape gives the focus to the legend button too
  const pos = page.app
    .getSim()
    .positions()
    .find((p) => p.key === "role:Plan");
  clickPoint(page, (pos.x + 0.5) * 24, (pos.y + 0.5) * 24);
  assert.equal(cardId(page), "agentA");
  page.doc.fire("keydown", { key: "Escape", preventDefault() {} });
  assert.ok(focused(page) === plan());
  // no legend button: the focus goes to the area of the office
  const bare = makePage({ entries: [...entries], now: S(10) });
  const legend = bare.doc.getElementById("legend");
  legend.parentNode.children.splice(
    legend.parentNode.children.indexOf(legend),
    1,
  );
  await bare.start();
  const p = bare.app
    .getSim()
    .positions()
    .find((x) => x.key === "role:Plan");
  clickPoint(bare, (p.x + 0.5) * 24, (p.y + 0.5) * 24);
  assert.equal(cardOpen(bare), true);
  bare.doc.fire("keydown", { key: "Escape", preventDefault() {} });
  assert.ok(focused(bare) === bare.el("office-scroll"));
  // the rings of the focus
  const rules = parseCss(
    fs.readFileSync(path.join(PUBLIC, "style.css"), "utf8"),
  );
  assert.match(
    cssDecls(rules, "summary:focus-visible").get("outline"),
    /^2px solid/,
  );
  assert.match(
    cssDecls(rules, "button:focus-visible").get("outline"),
    /^2px solid/,
  );
  assert.equal(
    cssDecls(rules, ".instance:focus-visible").get("outline-offset"),
    "-0.125rem",
  );
});

// ------------------------------------------------------------------ AC-04

test("AC-04: the head of the card and copying - a role of the table, out of the table, without a role; the code only when it differs; an id of 128 characters is 8 in the head and whole in the details; a fake clipboard: success calls writeText once with the whole value and says 'скопировано'; no clipboard, a refusal, an exception say 'не удалось скопировать', the value stays; the caption lives through a rebuild; seven instances - five items, 'показано 5 из 7', two under 'Остальные экземпляры'; the age of the items in work and without fresh data; choosing the second", async () => {
  const long = "L".repeat(128);
  const sessionLong = "s".repeat(128);
  const roles = [
    [ORCH_ROLE, "Оркестратор", ORCH_ROLE],
    ["Explore", "Explore", null],
  ];
  for (const [role, title, code] of roles) {
    const page = await loaded(
      [lineAt("SessionStart", "S1", S(1)), sub("S1", "k1", S(2), role)],
      [],
      { now: S(10) },
    );
    legendOf(page, `role:${role}`).click();
    assert.equal(cardEl(page).byClass("card-title")[0].textContent, title);
    const c = cardEl(page).byClass("card-code");
    if (code === null) assert.equal(c.length, 0);
    else assert.equal(c[0].textContent, code);
  }
  // no role: the card names it as the panel does
  const none = await loaded(
    [
      lineAt("SessionStart", "S1", S(1)),
      lineAt("SubagentStart", "S1", S(2), { agent_id: "k1" }),
    ],
    [],
    { now: S(10) },
  );
  legendOf(none, `role:${TX.ROLE_UNKNOWN}`).click();
  assert.equal(
    cardEl(none).byClass("card-title")[0].textContent,
    "(роль не указана)",
  );
  assert.equal(cardEl(none).byClass("card-code").length, 0);

  // copying, with the ids of 128 characters
  const calls = [];
  let reads = 0;
  const clip = {
    writeText: async (text) => {
      calls.push(text);
    },
    // copying never reads the clipboard
    readText: async () => {
      reads += 1;
      return "";
    },
  };
  const entries = [
    lineAt("SessionStart", sessionLong, S(1)),
    sub(sessionLong, long, S(2), "Plan"),
  ];
  const page = await loaded(entries, [], { now: S(10), clipboard: clip });
  legendOf(page, "role:Plan").click();
  assert.deepEqual(
    cardEl(page)
      .byClass("card-id")
      .map((e) => e.textContent),
    ["L".repeat(8), "s".repeat(8)],
  );
  const ids = cardEl(page).find((e) => e.dataset.part === "ids");
  assert.deepEqual(
    ids.byClass("full-id").map((e) => e.textContent),
    [long, sessionLong],
  );
  const copy = (target) =>
    cardEl(page).find((e) => e.dataset.focus === `copy-${target}`);
  assert.equal(
    copy("agent").getAttribute("aria-label"),
    "Скопировать номер экземпляра",
  );
  assert.equal(
    copy("session").getAttribute("aria-label"),
    "Скопировать номер сессии",
  );
  copy("agent").click();
  await settle();
  assert.deepEqual(calls, [long], "once, the whole value");
  const result = () =>
    cardEl(page)
      .byClass("copy-result")
      .map((e) => [e.textContent, e.dataset.ok]);
  assert.deepEqual(result(), [["скопировано", "true"]]);
  // the caption lives through the planned recalculation
  await page.tick(12_000);
  assert.deepEqual(result(), [["скопировано", "true"]]);
  copy("session").click();
  await settle();
  assert.deepEqual(calls, [long, sessionLong]);
  assert.deepEqual(
    result(),
    [["скопировано", "true"]],
    "only the last caption",
  );
  assert.equal(reads, 0, "the clipboard is never read");
  // failures: no clipboard, a refusal, an exception
  const failures = [
    { clipboard: null },
    { clipboard: { writeText: () => Promise.reject(new Error("no")) } },
    {
      clipboard: {
        writeText: () => {
          throw new Error("no");
        },
      },
    },
    {
      clipboardFn: () => {
        throw new Error("no");
      },
    },
    { clipboard: { other: 1 } },
  ];
  const errors = mock.method(console, "error", () => {});
  try {
    for (const env of failures) {
      const p = await loaded(entries, [], { now: S(10), ...env });
      legendOf(p, "role:Plan").click();
      cardEl(p)
        .find((e) => e.dataset.focus === "copy-agent")
        .click();
      await settle();
      assert.deepEqual(
        cardEl(p)
          .byClass("copy-result")
          .map((e) => e.textContent),
        ["не удалось скопировать — выделите значение вручную"],
      );
      assert.ok(
        cardEl(p)
          .byClass("full-id")
          .some((e) => e.textContent === long),
      );
    }
    assert.equal(errors.mock.calls.length, 0);
  } finally {
    errors.mock.restore();
  }

  // seven instances of one role: five shown, the note, two in "more"
  const seven = [
    lineAt("SessionStart", "S1", S(1)),
    lineAt("SessionStart", "S2", S(2)),
  ];
  for (let i = 0; i < 7; i++) {
    seven.push(sub(i < 3 ? "S1" : "S2", `inst-${i}`, S(3 + i), "Plan"));
  }
  seven.push(subEnd("S2", "inst-6", S(20), "Plan"));
  seven.push(tool("S1", T0 + 2 * 3600 * 1000 - 60_000, "tu-fresh"));
  const sp = await loaded(seven, [], { now: T0 + 2 * 3600 * 1000 });
  legendOf(sp, "role:Plan").click();
  const box = cardEl(sp);
  assert.equal(box.dataset.columns, "2");
  const list = box.find((e) => e.classes.has("card-instances"));
  assert.equal(
    list.byClass("card-count")[0].textContent,
    "экземпляров роли: 7",
  );
  const more = list.find((e) => e.dataset.part === "more");
  const shown = list
    .byClass("instance")
    .filter((b) => !more.all((x) => x === b).length);
  assert.equal(shown.length, 5);
  assert.equal(more.byClass("instance").length, 2);
  assert.equal(list.byClass("tasks-note")[0].textContent, "показано 5 из 7");
  const item = (key) => list.find((e) => e.dataset.key === key);
  const timeOf = (key) => item(key).byClass("instance-time")[0].textContent;
  assert.match(timeOf("inst-0"), /назад$/, "in work: an age");
  assert.equal(
    item("inst-0").byClass("state-badge")[0].textContent,
    "в работе",
  );
  assert.match(timeOf("inst-3"), /назад$/, "no fresh data: an age");
  assert.equal(
    item("inst-3").byClass("state-badge")[0].textContent,
    "нет свежих данных",
  );
  assert.doesNotMatch(timeOf("inst-6"), /назад/, "finished: no age");
  // the current one is marked; choosing another changes the head and the rows
  const current = () =>
    cardEl(sp).all(
      (e) =>
        e.classes.has("instance") && e.getAttribute("aria-current") === "true",
    );
  assert.equal(current().length, 1);
  assert.ok(current()[0].dataset.key.startsWith(cardId(sp)));
  const first = cardId(sp);
  const second = shown
    .map((b) => b.dataset.key)
    .find((k) => !k.startsWith(first));
  item(second).click();
  assert.equal(cardId(sp), second.slice(0, 8));
  assert.equal(
    cardEl(sp)
      .find((e) => e.dataset.key === second && e.classes.has("instance"))
      .getAttribute("aria-current"),
    "true",
  );
  assert.equal(
    cardEl(sp).all(
      (e) =>
        e.classes.has("instance") && e.getAttribute("aria-current") === "true",
    ).length,
    1,
  );
  assert.ok(
    focused(sp) ===
      cardEl(sp).find((e) => e.dataset.focus === `instance:${second}`),
  );
});

// ------------------------------------------------------------------ AC-08

test("AC-08: what the card shows at once is not hidden in a closed <details>; all parts are closed when the card opens; a planned recalculation with a new line keeps the open part, the instance, the element with the focus and the scroll of the body; in 'Вся роль' a task without fresh data has its age; no 'в работе: N' in the code of the page", async () => {
  const entries = [
    lineAt("SessionStart", "S1", S(1)),
    lineAt("PostToolUse", "S1", S(2), {
      tool_use_id: "tu1",
      launched_agent_id: "k1",
      subagent_type: "Plan",
      description: "дело",
    }),
    sub("S1", "k1", S(3), "Plan"),
    lineAt("SessionStart", "S2", S(4)),
    sub("S2", "k2", S(5), "Plan"),
    tool("S1", T0 + 2 * 3600 * 1000 - 60_000, "tu-fresh"),
  ];
  const page = await loaded(entries, [], { now: T0 + 2 * 3600 * 1000 });
  legendOf(page, "role:Plan").click();
  const box = () => cardEl(page);
  const insideClosed = (el) => {
    for (let p = el.parentNode; p !== null; p = p.parentNode) {
      if (p.tagName === "DETAILS" && p.open !== true) return true;
    }
    return false;
  };
  for (const el of [
    box().byClass("card-title")[0],
    box().byClass("card-ids")[0],
    ...box().all((e) => e.classes.has("state-row")),
    box().byClass("task-desc")[0],
    box().byClass("card-launcher")[0],
  ]) {
    assert.ok(el !== undefined);
    assert.equal(insideClosed(el), false, el.className);
  }
  const parts = () => box().all((e) => e.tagName === "DETAILS");
  assert.deepEqual(
    parts().map((d) => d.dataset.part),
    ["ids", "given", "starts", "returns", "launched", "role"],
  );
  assert.equal(
    parts().some((d) => d.open === true),
    false,
    "all closed",
  );
  // open "Начала работы" and "Полные идентификаторы", focus the copy button,
  // scroll the body
  for (const part of ["starts", "ids"]) {
    box()
      .find((e) => e.dataset.part === part)
      .children[0].click();
  }
  box()
    .find((e) => e.dataset.focus === "copy-session")
    .focus();
  box().byClass("card-body")[0].scrollTop = 40;
  const id = cardId(page);
  page.server.entries.push(tool("S1", page.clock.now(), "tu-new"));
  await page.tick(2000);
  await page.tick(10_000);
  assert.equal(cardId(page), id, "the same instance");
  assert.deepEqual(
    parts()
      .filter((d) => d.open === true)
      .map((d) => d.dataset.part),
    ["ids", "starts"],
  );
  assert.ok(
    focused(page) === box().find((e) => e.dataset.focus === "copy-session"),
  );
  assert.equal(box().byClass("card-body")[0].scrollTop, 40);
  assert.ok(box().byClass("card-body")[0] !== undefined);
  // "Вся роль": a task without fresh data has its age, as in the panel
  const role = box().find((e) => e.dataset.part === "role");
  const stale = role.all(
    (e) => e.classes.has("item") && e.dataset.state === "stale",
  );
  assert.equal(stale.length, 1);
  assert.match(stale[0].byClass("age")[0].textContent, /назад$/);
  // the old line of the card is in no module of the page (the export itself is
  // removed from texts.js at step 5c)
  const name = ["CARD", "WORKING"].join("_");
  for (const file of fs.readdirSync(PUBLIC)) {
    if (file === "texts.js") continue;
    assert.equal(
      fs.readFileSync(path.join(PUBLIC, file), "utf8").includes(name),
      false,
      file,
    );
  }
  assert.equal(page.text("card").includes("в работе: "), false);
  // the window of history never opens from a card (decision 0014): no button
  // of a window and no toggle of a row in the card of the instance and of the
  // main session (its last events hold the request of the owner)
  const ask = await loaded(
    [
      lineAt("SessionStart", "S1", S(1)),
      lineAt("UserPromptSubmit", "S1", S(2), {
        prompt_kind: "owner",
        prompt_text: "Образец",
      }),
      sub("S1", "k1", S(3), "Plan"),
    ],
    [],
    { now: S(10) },
  );
  for (const key of ["main", "role:Plan"]) {
    legendOf(ask, key).click();
    for (const part of cardEl(ask).all((e) => e.tagName === "DETAILS")) {
      part.open = true;
    }
    assert.equal(cardEl(ask).byClass("history-open").length, 0, key);
    assert.equal(cardEl(ask).byClass("row-toggle").length, 0, key);
    assert.ok(cardEl(ask).byClass("row").length >= 1, `${key}: rows of events`);
  }
});

// ------------------------------------------------------------------ AC-09

test("AC-09: the card on bad data - no description, no handoff, launched by an agent whose start is not recorded, no role, ids of 128 characters, an empty journal, the link lost with an open card (the contents stay, 'Нет связи' in the head), the instance gone (the card closes), an unreadable time - no exception, no service word", async () => {
  const errors = mock.method(console, "error", () => {});
  try {
    const long = "Q".repeat(128);
    const entries = [
      lineAt("SessionStart", "S1", S(1)),
      sub("S1", "nodesc", S(2), "Plan"),
      lineAt("PostToolUse", "S1", S(3), {
        tool_use_id: "tu-x",
        launched_agent_id: "child",
        subagent_type: "Explore",
        agent_id: "parent-not-recorded",
        agent_type: "Plan",
      }),
      sub("S1", "child", S(4), "Explore"),
      lineAt("SubagentStart", "S1", S(5), { agent_id: long }),
    ];
    const page = await loaded(entries, [], { now: S(10) });
    legendOf(page, "role:Plan").click();
    assert.equal(
      cardEl(page).byClass("task-none")[0].textContent,
      "описание не записано: записи о передаче задания нет",
    );
    assert.equal(
      cardEl(page).byClass("card-launcher")[0].textContent,
      "не установлено: записи о передаче задания нет",
    );
    legendOf(page, "role:Explore").click();
    assert.equal(
      cardEl(page).byClass("card-launcher")[0].textContent,
      "Plan · parent-n — начало этого агента не записано",
    );
    assert.equal(
      cardEl(page).byClass("task-none")[0].textContent,
      "описание не записано",
    );
    legendOf(page, `role:${TX.ROLE_UNKNOWN}`).click();
    assert.equal(cardId(page), "Q".repeat(8));
    assert.equal(
      cardEl(page).byClass("card-title")[0].textContent,
      "(роль не указана)",
    );
    for (const key of [
      "role:Plan",
      "role:Explore",
      `role:${TX.ROLE_UNKNOWN}`,
    ]) {
      legendOf(page, key).click();
      assert.doesNotMatch(cardEl(page).textContent, SERVICE, key);
    }
    // the link is lost while the card is open: the contents stay
    legendOf(page, "role:Plan").click();
    const before = cardEl(page).byClass("card-columns")[0].textContent;
    page.server.mode = "fail";
    await page.tick(2000);
    await page.tick(10_000);
    assert.equal(cardOpen(page), true);
    assert.equal(
      cardEl(page).byClass("card-offline")[0].textContent,
      "Нет связи с сервером Pixel Office",
    );
    assert.equal(cardEl(page).byClass("card-columns")[0].textContent, before);
    // the journal is replaced and the instance is gone: the card closes
    page.server.mode = "ok";
    page.server.entries.splice(
      0,
      page.server.entries.length,
      lineAt("SessionStart", "S9", S(11)),
    );
    page.server.respond = () => ({
      app: "sai-pixel-office",
      lines: 1,
      from: 0,
      events: page.server.entries,
      server_starts: [],
    });
    legendOf(page, "role:Plan").focus();
    cardEl(page).byClass("card-close")[0].focus();
    await page.tick(2000);
    assert.equal(cardOpen(page), false, "the instance is gone");
    assert.equal(cardEl(page).children.length, 0);
    // the focus was in the card: it goes to the area of the office (the
    // character and its legend button are gone too)
    assert.equal(legendOf(page, "role:Plan"), undefined);
    assert.ok(focused(page) === page.el("office-scroll"));
    // an empty journal: no character, nothing to open
    const empty = await loaded([], [], { now: S(10) });
    assert.equal(empty.legend().length, 0);
    assert.equal(cardOpen(empty), false);
    // an unreadable time: the card says so (the model of the card directly)
    const bad = [
      lineAt("SessionStart", "S1", S(1)),
      { ...sub("S1", "t1", S(2), "Plan"), time: "не время" },
    ];
    const mb = buildModel(bad, [], S(10));
    const cb = buildInstanceCard(mb, buildOffice(mb), "t1");
    assert.equal(cb.task_state.state, "stale");
    assert.equal(cb.task_state.age_ms, null);
    assert.equal(fmtDateTime("не время"), "");
    assert.equal(errors.mock.calls.length, 0, "reportOnce was not called");
  } finally {
    errors.mock.restore();
  }
});

// ------------------------------------------------------------------ AC-10

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const channel = (v) => {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const luminance = ([r, g, b]) =>
  0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

test("AC-10: a hostile role, description and agent_id are text in the card, no element; writeText gets only the value; no word of success, no way to markup, only GET in the code; the badges of the five states and the grey captions are readable (WCAG 4.5:1 on the tokens of style.css, the property of the colours, not a search for a word)", async () => {
  const IMGX = "<img src=x onerror=alert(1)>";
  const calls = [];
  const entries = [
    lineAt("SessionStart", "S1", S(1)),
    lineAt("PostToolUse", "S1", S(2), {
      tool_use_id: "tu1",
      launched_agent_id: IMGX,
      subagent_type: IMGX,
      description: IMGX,
    }),
    sub("S1", IMGX, S(3), IMGX),
  ];
  const page = await loaded(entries, [], {
    now: S(10),
    clipboard: { writeText: async (t) => calls.push(t) },
  });
  legendOf(page, `role:${IMGX}`).click();
  assert.equal(cardEl(page).byClass("card-title")[0].textContent, IMGX);
  assert.equal(cardEl(page).byClass("task-desc")[0].textContent, IMGX);
  cardEl(page)
    .find((e) => e.dataset.part === "ids")
    .children[0].click();
  cardEl(page)
    .find((e) => e.dataset.focus === "copy-agent")
    .click();
  await settle();
  assert.deepEqual(calls, [IMGX]);
  assert.equal(page.created("img").length, 0);
  assert.equal(page.doc.htmlWrites, 0);
  // the code of the page
  for (const name of fs.readdirSync(PUBLIC)) {
    const text = fs.readFileSync(path.join(PUBLIC, name), "utf8");
    assert.equal(
      /innerHTML|outerHTML|insertAdjacentHTML|document\.write/.test(text),
      false,
      name,
    );
    assert.equal(
      /method *: *['"](POST|PUT|PATCH|DELETE)/.test(text),
      false,
      name,
    );
    for (const line of text.split("\n")) {
      if (line.includes("HISTORY_META_FINISHED")) continue;
      assert.doesNotMatch(line, /заверш|готов|выполнен|успешн/i, name);
    }
  }
  // the contrast of the badges and of the grey captions
  const rules = parseCss(
    fs.readFileSync(path.join(PUBLIC, "style.css"), "utf8"),
  );
  const tokens = cssDecls(rules, ":root");
  const color = (value, base) => {
    const v = /^var\((--[a-z0-9-]+)\)$/.exec(value);
    if (v) return hex(tokens.get(v[1]));
    const m = /^rgba\((\d+), (\d+), (\d+), ([0-9.]+)\)$/.exec(value);
    assert.ok(m, value);
    const a = Number(m[4]);
    return [1, 2, 3].map((i, k) =>
      Math.round(Number(m[i]) * a + base[k] * (1 - a)),
    );
  };
  for (const surface of ["--panel", "--panel-2"]) {
    const base = hex(tokens.get(surface));
    for (const state of [
      "in_progress",
      "completed",
      "stale",
      "restarted",
      "unrecorded",
    ]) {
      const d = cssDecls(rules, `.state-badge[data-state="${state}"]`);
      const r = contrast(
        color(d.get("color"), base),
        color(d.get("background"), base),
      );
      assert.ok(r >= 4.5, `${state} on ${surface}: ${r.toFixed(2)}:1`);
    }
    const muted = contrast(hex(tokens.get("--muted")), base);
    assert.ok(muted >= 4.5, `--muted on ${surface}: ${muted.toFixed(2)}:1`);
  }
  // the formula fails a pair that is too pale (the red word on its own shade)
  const err = cssDecls(rules, '.state-badge[data-state="unrecorded"]').get(
    "background",
  );
  const pale = contrast(
    hex(tokens.get("--err")),
    color(err, hex(tokens.get("--panel-2"))),
  );
  assert.ok(pale < 4.5, `--err on its shade: ${pale.toFixed(2)}:1`);
});
