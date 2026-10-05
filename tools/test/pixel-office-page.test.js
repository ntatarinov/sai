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
  const j = journal();
  j.prompt("S1");
  const row = model(j.entries).mainRows[0];
  assert.deepEqual(Object.keys(row).sort(), [
    "closed_by",
    "end_index",
    "ended_at",
    "key",
    "kind",
    "session_id",
    "start_index",
    "started_at",
    "state",
  ]);
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
