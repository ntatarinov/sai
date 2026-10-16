// OF: the office, the simulator, the drawing, the card and the report
// (design 10.2; REQ-007 criteria 1-7, 9-13). The office is a function of the
// journal; the tests build journals with constructors and an explicit time.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { mock, test } from "node:test";
import { buildModel } from "../src/pixel-office/public/model.js";
import { roleName } from "../src/pixel-office/public/words.js";
import { STALE_AFTER_MS } from "../src/pixel-office/public/schema.js";
import {
  ROLE_PALETTE,
  bubblesAt,
  buildCard,
  buildOffice,
  colorOfDesk,
  roleLabel,
} from "../src/pixel-office/public/office-model.js";
import {
  createSim,
  PAUSE,
  SPEED,
} from "../src/pixel-office/public/office-sim.js";
import {
  LABEL_FONT,
  LABEL_PLATE_COLOR,
  MIN_CELL_PX,
  canvasPoint,
  drawOffice,
  hitTest,
  labelPlate,
} from "../src/pixel-office/public/office-view.js";
import {
  FIXED_CELLS,
  buildLayout,
  canStep,
  cellKind,
  deskSpot,
  findPath,
} from "../src/pixel-office/public/layout.js";
import {
  buildReport,
  runReport,
} from "../src/pixel-office/public/office-report.js";
import {
  BUBBLE_TEXTS,
  CANVAS_UNSUPPORTED,
  CARD_SESSIONS,
  LEGEND_IDLE,
  LEGEND_IDLE_MAIN,
  LEGEND_WORKING,
  ROOM_LABELS,
} from "../src/pixel-office/public/texts.js";
import {
  NOW,
  PUBLIC,
  REPORT_JS,
  LEGEND_ROLES,
  T0,
  agentFiles,
  agentNames,
  at,
  entryOf,
  journal,
  legendJournal,
  makeCtx,
  makePage,
  cssDecls,
  parseCss,
  rolesJournal,
  sandbox,
  setPanelInts,
  setPanelRects,
  settle,
  sha256File,
  withText,
} from "./pixel-office-helpers.js";

const IMG = "<img src=x onerror=alert(1)>";
const K = agentFiles().length;
const PALETTE = [
  "#e8b64c",
  "#5aa9ff",
  "#b48ce8",
  "#48c98a",
  "#4fd0c0",
  "#7ed957",
  "#ef6b5e",
  "#f08a5d",
  "#6bd4ef",
  "#9aa7ff",
  "#f0c674",
  "#c98ad4",
];

const mk = (entries, starts = [], now = NOW) => {
  const m = buildModel(entries, starts, now);
  return { m, o: buildOffice(m) };
};
const charOf = (o, key) => o.characters.find((c) => c.key === key);
const desks = (o) =>
  Object.fromEntries(o.characters.map((c) => [c.key, c.desk_index]));

// A subagent launch: the linking line and the start.
function launch(j, session, id, role, by = {}) {
  j.post(session, `tu-${id}`, id, {
    subagentType: role,
    description: `do ${id}`,
    ...by,
  });
  return j.subStart(session, id, role);
}

// ------------------------------------------------------------------ OF-01

test("OF-01: composition - no events, no characters; SessionStart gives main at desk 0; a role with no tasks has no character; __proto__, constructor and main are ordinary roles", () => {
  assert.equal(mk([]).o.characters.length, 0);
  const j = journal();
  j.sessionStart("S1");
  let { o } = mk(j.entries);
  assert.deepEqual(
    o.characters.map((c) => [c.key, c.desk_index]),
    [["main", 0]],
  );
  launch(j, "S1", "a1", "Explore");
  o = mk(j.entries).o;
  assert.deepEqual(
    o.characters.map((c) => c.key),
    ["main", "role:Explore"],
  );
  // a role that only appears in a linking line (no task) has no character
  const k = journal();
  k.sessionStart("S1");
  k.post("S1", "tu", "ghost", { subagentType: "Plan" });
  assert.deepEqual(
    mk(k.entries).o.characters.map((c) => c.key),
    ["main"],
  );
  // hostile role names
  const h = journal();
  h.sessionStart("S1");
  for (const [i, role] of ["__proto__", "constructor", "main"].entries()) {
    h.subStart("S1", `x${i}`, role);
  }
  o = mk(h.entries).o;
  assert.deepEqual(
    o.characters.map((c) => c.key),
    ["main", "role:__proto__", "role:constructor", "role:main"],
  );
  assert.deepEqual(
    o.characters.map((c) => c.desk_index),
    [0, 1, 2, 3],
  );
  assert.equal(o.characters.filter((c) => c.kind === "main").length, 1);
  assert.equal(charOf(o, "role:main").full, "main");
});

// ------------------------------------------------------------------ OF-02

test("OF-02: places depend only on the journal - whole, in parts or appended; a new role in the end takes the next number; the order is the first appearance; a line that loses trust recalculates", async () => {
  const roles = [
    "Explore",
    "Plan",
    "general-purpose",
    "Sai Reviewer (REVIEWER)",
  ];
  const j = journal();
  j.sessionStart("S1");
  roles.forEach((r, i) => launch(j, "S1", `a${i}`, r));
  const whole = desks(mk(j.entries).o);
  assert.equal(JSON.stringify(desks(mk(j.entries).o)), JSON.stringify(whole));
  // in parts and appended, through the page
  const page = makePage({ entries: j.entries.slice(0, 5) });
  await page.start();
  const half = desks(page.app.getOffice());
  page.server.entries.push(...j.entries.slice(5));
  await page.tick(2000);
  assert.deepEqual(desks(page.app.getOffice()), whole);
  for (const [key, d] of Object.entries(half))
    assert.equal(whole[key], d, "an earlier place moved");
  // a new role in the end of the journal
  launch(j, "S1", "a9", "Demo Role");
  const more = desks(mk(j.entries).o);
  for (const [key, d] of Object.entries(whole)) assert.equal(more[key], d);
  assert.equal(more["role:Demo Role"], Object.keys(whole).length);
  // order of the first appearance, not of the name
  assert.equal(whole["role:Explore"], 1);
  assert.equal(whole["role:Plan"], 2);
  // a line that loses trust (rule c: a last line from the future) is left out
  const base = journal();
  base.sessionStart("S1");
  launch(base, "S1", "a1", "Explore");
  launch(base, "S1", "a2", "Plan");
  const without = desks(mk(base.entries).o);
  const withFuture = base.entries.concat([
    entryOf("SubagentStart", "S1", at(3600), {
      agent_id: "a3",
      agent_type: "Late",
    }),
  ]);
  assert.deepEqual(desks(mk(withFuture, [], T0 + 60_000).o), without);
  assert.ok("role:Late" in desks(mk(withFuture, [], T0 + 3600_000).o));
  // rule b: a written-in line in the middle (an hour back) is left out
  const mid = base.entries.slice();
  mid.splice(
    2,
    0,
    entryOf("SubagentStart", "S1", at(-3600), {
      agent_id: "z",
      agent_type: "Zed",
    }),
  );
  const tail = journal();
  tail.time(10);
  for (let i = 0; i < 12; i++) tail.prompt("S1");
  const combined = mid.concat(tail.entries);
  assert.equal("role:Zed" in desks(mk(combined, [], T0 + 100_000).o), false);
});

// ------------------------------------------------------------------ OF-03

test("OF-03: no role is without a desk - for N = 1, K + 3 and 3(K + 3), N + 1 distinct desks 0..N; the layout is buildLayout(N + 1); the legend has N + 1 items, each with a desk", async () => {
  for (const n of [1, K + 3, 3 * (K + 3)]) {
    const j = rolesJournal(n);
    const { o } = mk(j.entries);
    assert.equal(o.characters.length, n + 1);
    assert.deepEqual(
      o.characters.map((c) => c.desk_index),
      Array.from({ length: n + 1 }, (_v, i) => i),
    );
    assert.deepEqual(o.layout, buildLayout(n + 1));
    const page = makePage({ entries: [...j.entries] });
    await page.start();
    assert.equal(page.legend().length, n + 1);
    assert.equal(withText(page.el("legend"), "нет стола").length, 0);
  }
});

// ------------------------------------------------------------------ OF-04

test("OF-04: running sessions - one has no badge; two give sessions_running = 2; SessionEnd does not count; SessionEnd, SessionStart resume with the same id and a start - the session runs and its task is in progress; no event after the last server start - not running", () => {
  const badges = (o) => {
    const ctx = makeCtx();
    const seat = o.layout.desks[0].seat;
    drawOffice(ctx, o, {
      positions: [{ key: "main", x: seat[0], y: seat[1], state: "seated" }],
      selectedKey: null,
      bubbles: new Map(),
      cellPx: 24,
    });
    return ctx.calls.filter(
      (c) =>
        c.op === "fillRect" &&
        c.fillStyle === "#b48ce8" &&
        c.args[2] === 10 &&
        c.args[3] === 10,
    ).length;
  };
  const j = journal();
  j.sessionStart("A");
  assert.equal(charOf(mk(j.entries).o, "main").sessions_running, 1);
  assert.equal(badges(mk(j.entries).o), 0);
  j.sessionStart("B");
  const two = mk(j.entries).o;
  assert.equal(charOf(two, "main").sessions_running, 2);
  assert.equal(badges(two), 1);
  j.sessionEnd("A");
  assert.equal(charOf(mk(j.entries).o, "main").sessions_running, 1);
  const resumed = journal();
  resumed.sessionStart("S1");
  resumed.sessionEnd("S1");
  resumed.sessionStart("S1");
  resumed.subStart("S1", "a1", "Explore");
  const r = mk(resumed.entries);
  assert.equal(charOf(r.o, "main").sessions_running, 1);
  assert.equal(r.m.tasks[0].state, "in_progress");
  const quiet = journal();
  quiet.sessionStart("S1");
  assert.equal(
    charOf(mk(quiet.entries, [{ time: at(9), journal_lines: 1 }]).o, "main")
      .sessions_running,
    0,
  );
  // REQ-042 (REQ-007 criterion 1): a session runs only while its last event is
  // not older than STALE_AFTER_MS; the clock is a number given by the test
  const aged = journal();
  aged.sessionStart("OLD"); // at(1)
  aged.time(1800);
  aged.sessionStart("NEW"); // at(1801)
  const old = Date.parse(at(1));
  const fresh = Date.parse(at(1801));
  const running = (now) =>
    charOf(mk(aged.entries, [], now).o, "main").sessions_running;
  assert.equal(running(old + STALE_AFTER_MS), 2, "on the threshold both run");
  assert.equal(running(old + STALE_AFTER_MS + 1), 1, "the old one stopped");
  assert.equal(running(fresh + STALE_AFTER_MS), 1);
  assert.equal(running(fresh + STALE_AFTER_MS + 1), 0, "both are stale");
  assert.equal(
    badges(mk(aged.entries, [], old + STALE_AFTER_MS + 1).o),
    0,
    "one running session - no badge",
  );
});

// ------------------------------------------------------------------ OF-05

const working = (o, key) => ({
  w: charOf(o, key)?.working,
  n: charOf(o, key)?.working_count,
});

test("OF-05: states at once by the event - one start works with 1; two parallel starts of one type give 2; one end gives 1; both ends - not working; unrecorded does not work; a marked line changes nothing; the main session", () => {
  const j = journal();
  j.sessionStart("S1");
  j.subStart("S1", "a1", "Explore");
  assert.deepEqual(working(mk(j.entries).o, "role:Explore"), { w: true, n: 1 });
  j.subStart("S1", "a2", "Explore");
  assert.deepEqual(working(mk(j.entries).o, "role:Explore"), { w: true, n: 2 });
  j.subStop("S1", "a1", "Explore");
  assert.deepEqual(working(mk(j.entries).o, "role:Explore"), { w: true, n: 1 });
  j.subStop("S1", "a2", "Explore");
  assert.equal(working(mk(j.entries).o, "role:Explore").w, false);
  // unrecorded
  const u = journal();
  u.subStart("S1", "a1", "Explore");
  assert.equal(
    working(
      mk(u.entries, [{ time: at(9), journal_lines: 1 }]).o,
      "role:Explore",
    ).w,
    false,
  );
  // marked
  const m = journal();
  m.sessionStart("S1");
  m.raw({
    ...entryOf("SubagentStart", "S1", at(5), {
      agent_id: "x",
      agent_type: "Ghost",
    }),
    source: "SIMULATION",
  });
  assert.equal(charOf(mk(m.entries).o, "role:Ghost"), undefined);
  // the main session
  const p = journal();
  p.sessionStart("S1");
  p.prompt("S1");
  assert.equal(working(mk(p.entries).o, "main").w, true);
  assert.equal(
    working(mk(p.entries, [{ time: at(9), journal_lines: 2 }]).o, "main").w,
    false,
  );
  p.stop("S1");
  assert.equal(
    working(mk(p.entries, [{ time: at(9), journal_lines: 2 }]).o, "main").w,
    false,
    "a late Stop changes no working state",
  );
  const twice = journal();
  twice.sessionStart("S1");
  twice.prompt("S1");
  twice.prompt("S1");
  assert.deepEqual(working(mk(twice.entries).o, "main"), { w: true, n: 1 });
});

test("OF-05b: the state changes at once also on a pause and at 4x, before any tick", async () => {
  const j = journal();
  j.sessionStart("S1");
  const page = makePage({ entries: [...j.entries] });
  await page.start();
  page.app.setPaused(true);
  page.app.setSpeed(4);
  j.subStart("S1", "a1", "Explore");
  await page.push(j.entries[1]);
  const ch = charOf(page.app.getOffice(), "role:Explore");
  assert.equal(ch.working, true);
  const items = page.legend().find((b) => b.dataset.key === "role:Explore");
  assert.equal(items.dataset.state, "working");
});

// ------------------------------------------------------------------ OF-06

const routesOf = (j, starts = []) => mk(j.entries, starts).o.routes;

test("OF-06: routes - none before an event; a start from the main session gives a handoff main -> role; an end gives a result role -> main; a launch from a subagent walks from that subagent; no linking line - no route; a repeated start - no new route; a role starting itself - none; marked lines - none; a late linking line - result after the handoff, ordered by event_index", () => {
  const j = journal();
  j.sessionStart("S1");
  assert.deepEqual(routesOf(j), []);
  const s1 = launch(j, "S1", "a1", "Explore");
  let routes = routesOf(j);
  assert.equal(routes.length, 1);
  assert.deepEqual(
    [routes[0].kind, routes[0].walker, routes[0].target],
    ["handoff", "main", "role:Explore"],
  );
  assert.equal(routes[0].event_index, s1);
  const stop = j.subStop("S1", "a1", "Explore");
  routes = routesOf(j);
  assert.deepEqual(
    routes.map((r) => r.kind),
    ["handoff", "result"],
  );
  assert.deepEqual(
    [routes[1].walker, routes[1].target],
    ["role:Explore", "main"],
  );
  assert.equal(routes[1].after, routes[0].id);
  assert.equal(routes[1].event_index, stop);
  // a repeated start: no new route
  j.subStart("S1", "a1", "Explore");
  assert.equal(routesOf(j).filter((r) => r.kind === "handoff").length, 1);
  // a launch from inside a subagent walks from the subagent
  const n = journal();
  n.sessionStart("S1");
  launch(n, "S1", "a1", "Explore");
  launch(n, "S1", "a2", "Plan", { byId: "a1", byType: "Explore" });
  const nested = routesOf(n).filter((r) => r.target === "role:Plan");
  assert.equal(nested[0].walker, "role:Explore");
  // no linking line: no route
  const bare = journal();
  bare.sessionStart("S1");
  bare.subStart("S1", "a1", "Explore");
  bare.subStop("S1", "a1", "Explore");
  assert.deepEqual(routesOf(bare), []);
  // a role starts itself
  const self = journal();
  self.sessionStart("S1");
  launch(self, "S1", "a1", "Explore");
  launch(self, "S1", "a2", "Explore", { byId: "a1", byType: "Explore" });
  assert.equal(routesOf(self).filter((r) => r.walker === r.target).length, 0);
  // marked lines give no routes
  const marked = journal();
  marked.sessionStart("S1");
  marked.raw({
    ...entryOf("PostToolUse", "S1", at(5), {
      tool_use_id: "t",
      launched_agent_id: "x",
      subagent_type: "Ghost",
    }),
    source: "SIMULATION",
  });
  marked.raw({
    ...entryOf("SubagentStart", "S1", at(6), {
      agent_id: "x",
      agent_type: "Ghost",
    }),
    source: "SIMULATION",
  });
  assert.deepEqual(routesOf(marked), []);
  // a linking line after the end: the result carries the id of its handoff
  const late = journal();
  late.sessionStart("S1");
  late.subStart("S1", "a1", "Explore");
  late.subStop("S1", "a1", "Explore");
  late.post("S1", "tu", "a1", { subagentType: "Explore" });
  const lr = routesOf(late);
  assert.deepEqual(
    lr.map((r) => r.kind),
    ["handoff", "result"],
  );
  assert.equal(lr[1].after, lr[0].id);
  assert.ok(lr[0].event_index <= lr[1].event_index);
});

// ------------------------------------------------------------------ OF-07

test("OF-07: from_cell is the seat of the walker's desk, to_cell the approach of the target's desk; a call from a subagent starts at its desk; no end cell is in the block of rooms", () => {
  const j = journal();
  j.sessionStart("S1");
  launch(j, "S1", "a1", "Explore");
  launch(j, "S1", "a2", "Plan", { byId: "a1", byType: "Explore" });
  j.subStop("S1", "a2", "Plan");
  j.subStop("S1", "a1", "Explore");
  const { o } = mk(j.entries);
  assert.ok(o.routes.length >= 4);
  const d = desks(o);
  for (const r of o.routes) {
    assert.deepEqual(r.from_cell, deskSpot(d[r.walker]).seat);
    assert.deepEqual(r.to_cell, deskSpot(d[r.target]).approach);
    for (const [x, y] of [r.from_cell, r.to_cell])
      assert.equal(x >= 23 && y <= 23, false);
  }
  const nested = o.routes.find(
    (r) => r.target === "role:Plan" && r.kind === "handoff",
  );
  assert.deepEqual(nested.from_cell, deskSpot(d["role:Explore"]).seat);
});

// ------------------------------------------------------------------ OF-08

function checkMoves(sim, layoutOf, state) {
  for (const p of sim.positions()) {
    const cell = sim.cell(p.key);
    const layout = layoutOf();
    const kind = cellKind(layout, cell[0], cell[1]);
    assert.ok(
      ["floor", "tile", "seat"].includes(kind),
      `${p.key} stands on ${kind} at ${cell}`,
    );
    const prev = state.get(p.key);
    if (prev !== undefined && (prev[0] !== cell[0] || prev[1] !== cell[1])) {
      assert.equal(
        Math.abs(prev[0] - cell[0]) + Math.abs(prev[1] - cell[1]),
        1,
        `${p.key} jumped`,
      );
      assert.equal(
        canStep(layout, prev[0], prev[1], cell[0], cell[1]),
        true,
        `${p.key} crossed a barrier ${prev} -> ${cell}`,
      );
    }
    state.set(p.key, cell);
  }
}

test("OF-08: walking keeps to walkable cells - 40+ events with nested launches and a growing office; every step is allowed by canStep; in the end everybody sits on their seat", () => {
  const j = journal();
  j.sessionStart("S1");
  j.prompt("S1");
  const sim = createSim();
  let office = null;
  const state = new Map();
  const names = Array.from({ length: 14 }, (_v, i) => `Role${i}`);
  const feed = () => {
    const m = buildModel(j.entries, [], NOW);
    office = buildOffice(m);
    sim.sync(office);
    sim.enqueue(office.routes);
  };
  const run = (frames) => {
    for (let i = 0; i < frames; i++) {
      sim.tick(1 / 60);
      checkMoves(sim, () => office.layout, state);
    }
  };
  feed();
  names.forEach((role, i) => {
    const by =
      i >= 4 && i % 3 === 0 ? { byId: `a${i - 3}`, byType: names[i - 3] } : {};
    launch(j, "S1", `a${i}`, role, by);
    feed();
    run(25);
    if (i % 2 === 1) {
      j.subStop("S1", `a${i - 1}`, names[i - 1]);
      feed();
      run(25);
    }
  });
  for (let i = 0; i < names.length; i++) {
    const stopped = j.entries.some(
      (e) => e.hook_event_name === "SubagentStop" && e.agent_id === `a${i}`,
    );
    if (!stopped) j.subStop("S1", `a${i}`, names[i]);
  }
  feed();
  assert.ok(j.entries.length >= 40);
  let guard = 0;
  while (
    sim.positions().some((p) => p.state !== "seated" || p.queued > 0) &&
    guard < 400_000
  ) {
    run(1);
    guard += 1;
  }
  assert.ok(guard < 400_000, "the movement did not end");
  for (const p of sim.positions()) {
    const seat = office.layout.desks[p.desk_index].seat;
    assert.deepEqual([p.x, p.y], seat, `${p.key} is not on its seat`);
  }
});

// ------------------------------------------------------------------ OF-09

test("OF-09: an unreachable target - the walker does not move, the route is skipped, the result that waits for it starts", () => {
  const j = journal();
  j.sessionStart("S1");
  launch(j, "S1", "a1", "Explore");
  j.subStop("S1", "a1", "Explore");
  const { o } = mk(j.entries);
  const handoff = o.routes.find((r) => r.kind === "handoff");
  const blocked = (layout, x, y, nx, ny) =>
    !(nx === handoff.to_cell[0] && ny === handoff.to_cell[1]) &&
    canStep(layout, x, y, nx, ny);
  const sim = createSim({ canStep: blocked });
  sim.sync(o);
  sim.enqueue(o.routes);
  sim.tick(0.5);
  const pos = Object.fromEntries(sim.positions().map((p) => [p.key, p]));
  assert.equal(pos.main.state, "seated");
  assert.deepEqual([pos.main.x, pos.main.y], handoff.from_cell);
  assert.equal(pos["role:Explore"].state, "walking");
  assert.ok(pos["role:Explore"].route.endsWith(":result"));
});

// ------------------------------------------------------------------ OF-10

function clickCharacter(page, key) {
  const office = page.app.getOffice();
  const c = office.characters.find((x) => x.key === key);
  const seat = office.layout.desks[c.desk_index].seat;
  // the canvas is shown at 24 px per cell, whatever its cell: a click is then
  // in logical px of the canvas
  page.canvas.rect = {
    left: 0,
    top: 0,
    width: office.layout.width * 24,
    height: office.layout.height * 24,
  };
  const k = 24;
  page.canvas.click({
    clientX: (seat[0] - office.layout.min_x) * k + 12,
    clientY: seat[1] * k + 12,
  });
}

test("OF-10: the card - the role, its tasks in progress, up to 5 completed, up to 10 trusted events; the title is the name of the role in plain words, the code is only in the details; a click selects and opens it; one more event changes the views together", async () => {
  const role = "Sai Orchestrator (ORCH)";
  const j = journal();
  j.sessionStart("S1");
  for (let i = 0; i < 7; i++) {
    launch(j, "S1", `c${i}`, role);
    j.subStop("S1", `c${i}`, role);
  }
  launch(j, "S1", "live", role);
  // an event with agent_type of the role but without agent_id belongs to the main session
  j.raw({
    ...entryOf("UserPromptSubmit", "S1", at(j.now())),
    agent_type: role,
  });
  j.raw({
    ...entryOf("Stop", "S1", at(j.now()), { agent_id: "z", agent_type: role }),
    source: "SIMULATION",
  });
  const page = makePage({ entries: [...j.entries] });
  await page.start();
  const o = page.app.getOffice();
  const card = buildCard(page.app.getModel(), o, `role:${role}`);
  assert.equal(card.full, role);
  // REQ-048: one name of the role everywhere (roleLabel builds no caption)
  assert.equal(card.label, "Оркестратор");
  assert.equal(card.in_progress.length, 1);
  assert.equal(card.recent_completed.length, 5);
  assert.ok(card.recent_events.length <= 10 && card.recent_events.length > 0);
  for (const row of card.recent_events) {
    assert.equal(row.marked, false);
    const e = page.app.getModel().entries[row.index];
    assert.notEqual(
      e.hook_event_name,
      "UserPromptSubmit",
      "a line without agent_id is not in the card of a role",
    );
    assert.ok(
      typeof e.agent_id === "string" || e.hook_event_name === "PostToolUse",
      "only the role's own lines and its linking lines",
    );
  }
  clickCharacter(page, `role:${role}`);
  assert.equal(page.el("card-overlay").hidden, false);
  // REQ-044, REQ-048: the title is the name of the role in plain words; the
  // code of the role is only in the details of the head
  assert.equal(
    page.el("card").byClass("card-title")[0].textContent,
    "Оркестратор",
  );
  assert.equal(page.el("card").byClass("card-code").length, 0);
  assert.deepEqual(
    page
      .el("card")
      .byClass("code-row")
      .map((e) => e.textContent),
    [`код роли: ${role}`],
  );
  const pressed = page.legend().find((b) => b.dataset.key === `role:${role}`);
  assert.equal(pressed.getAttribute("aria-pressed"), "true");
  page.ctx.clear();
  page.frames.step();
  const frame = page.ctx.lastFrame();
  assert.ok(
    frame.some((c) => c.op === "fillRect" && c.fillStyle === "#5aa9ff"),
    "a frame around the selected",
  );
  // one more event: journal, list, office and card change together
  const before = {
    rows: page.rows().length,
    items: page.el("card").byClass("item").length,
  };
  j.subStart("S1", "late", role);
  await page.push(j.entries[j.entries.length - 1]);
  assert.equal(page.rows().length, before.rows + 1);
  assert.equal(
    page.app.getOffice().characters.find((c) => c.full === role).working_count,
    2,
  );
  assert.ok(page.el("card").byClass("item").length > before.items - 1);
  assert.equal(page.el("card").byClass("card-working").length, 0);
  assert.equal(workplaceOf(page), "работает — у этой роли задач «в работе»: 2");
});

// The line "Рабочее место" of the card of an instance (REQ-044).
function workplaceOf(page) {
  return page
    .el("card")
    .find((e) => e.dataset.row === "workplace")
    .byClass("state-value")[0].textContent;
}

// ------------------------------------------------------------------ OF-11

test("OF-11: only GET in a whole session with the office; a hostile description and role are text on the canvas, the board, the legend and the card - never an element", async () => {
  const j = journal();
  j.sessionStart("S1");
  j.post("S1", "tu", "a1", { subagentType: IMG, description: IMG });
  j.subStart("S1", "a1", IMG);
  const page = makePage({ entries: [...j.entries] });
  await page.start();
  for (let i = 0; i < 3; i++) await page.tick(2000);
  clickCharacter(page, `role:${IMG}`);
  assert.equal(page.el("card").byClass("card-title")[0].textContent, IMG);
  page.legend()[0].click();
  page.app.setPaused(true);
  page.app.setSpeed(2);
  page.frames.run(5);
  assert.equal(page.created("img").length, 0);
  assert.equal(page.doc.htmlWrites, 0);
  const texts = page.ctx.calls
    .filter((c) => c.op === "fillText")
    .map((c) => c.args[0]);
  assert.ok(
    texts.some((t) => t.startsWith("<img src=x")),
    "the label is drawn as text",
  );
  assert.ok(withText(page.el("legend"), IMG).length >= 1);
  for (const c of page.server.calls) assert.equal(c.method, "GET");
});

// ------------------------------------------------------------------ OF-12

test("OF-12: the files of the office and panels exist; index.html and the browser modules do not use office-report.js", () => {
  for (const f of [
    "layout",
    "office-model",
    "office-sim",
    "office-view",
    "panels",
    "office-report",
  ]) {
    assert.ok(fs.existsSync(path.join(PUBLIC, `${f}.js`)), f);
  }
  assert.equal(
    /office-report/.test(
      fs.readFileSync(path.join(PUBLIC, "index.html"), "utf8"),
    ),
    false,
  );
  for (const f of fs
    .readdirSync(PUBLIC)
    .filter((x) => x.endsWith(".js") && x !== "office-report.js")) {
    const code = fs
      .readFileSync(path.join(PUBLIC, f), "utf8")
      .replace(/\/\/[^\n]*/g, "");
    assert.equal(/office-report/.test(code), false, f);
  }
});

// ------------------------------------------------------------------ OF-13

function writeJournal(box, entries, starts) {
  fs.mkdirSync(box.dir, { recursive: true });
  const file = path.join(box.dir, "events.jsonl");
  fs.writeFileSync(file, entries.map((e) => `${JSON.stringify(e)}\n`).join(""));
  if (starts !== undefined) {
    fs.writeFileSync(
      path.join(box.dir, "server-starts.jsonl"),
      starts.map((s) => `${JSON.stringify(s)}\n`).join(""),
    );
  }
  return file;
}

function twoSessions() {
  const j = journal();
  j.sessionStart("S1");
  j.prompt("S1");
  launch(j, "S1", "a1", "general-purpose");
  j.subStop("S1", "a1", "general-purpose");
  j.stop("S1");
  j.sessionStart("S2");
  j.prompt("S2");
  launch(j, "S2", "a2", "Explore");
  return j;
}

function runReportChild(args) {
  const r = spawnSync(process.execPath, [REPORT_JS, ...args], {
    encoding: "utf8",
    timeout: 20000,
    env: { PATH: process.env.PATH, HOME: os.tmpdir() },
  });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}

test("OF-13: office-report.js on a fixed journal of two sessions - one role, desk_index a number, two routes, the role is not working, the server starts are used; without --session the whole journal; the journal is not changed", (t) => {
  const box = sandbox(t);
  const j = twoSessions();
  const file = writeJournal(box, j.entries, [
    { time: at(100), journal_lines: j.entries.length },
  ]);
  const before = sha256File(file);
  const r = runReportChild(["--journal", file, "--session", "S1"]);
  assert.equal(r.code, 0, r.stderr);
  const rep = JSON.parse(r.stdout);
  assert.equal(rep.session, "S1");
  assert.equal(rep.roles.length, 1);
  assert.equal(rep.roles[0].key, "role:general-purpose");
  assert.equal(typeof rep.roles[0].desk_index, "number");
  assert.equal(rep.roles[0].working, false);
  assert.equal(rep.events, 6);
  assert.equal(rep.trusted, rep.events);
  assert.deepEqual(
    rep.routes.map((x) => [x.kind, x.walker, x.target]),
    [
      ["handoff", "main", "role:general-purpose"],
      ["result", "role:general-purpose", "main"],
    ],
  );
  assert.equal(rep.main.present, true);
  // the whole journal: the server start makes the task of S2 'сервер
  // перезапускался…' (REQ-042 criterion 6). The child process reads the real
  // clock (a journal of 2026 is stale today), so it is compared only on what
  // the clock does not change: the state 'restarted' outranks 'stale'.
  const all = JSON.parse(runReportChild(["--journal", file]).stdout);
  assert.equal(all.session, null);
  assert.equal(all.roles.length, 2);
  const explore = all.roles.find((x) => x.role === "Explore");
  assert.equal(explore.working, false);
  assert.deepEqual(explore.counts, {
    in_progress: 0,
    stale: 0,
    restarted: 1,
    completed: 0,
    unrecorded: 0,
  });
  assert.equal(sha256File(file), before);
});

// ----------------------------------------------------------------- OF-14

test("OF-14: getContext returned null - the canvas is hidden, #office-note says CANVAS_UNSUPPORTED; the legend, journal, task panel and card work", async () => {
  const j = journal();
  j.sessionStart("S1");
  launch(j, "S1", "a1", "Explore");
  const page = makePage({ entries: [...j.entries], canvas: false });
  await page.start();
  assert.equal(page.canvas.hidden, true);
  assert.equal(page.text("office-note"), CANVAS_UNSUPPORTED);
  assert.equal(page.el("office-note").hidden, false);
  assert.ok(page.rows().length >= 2);
  assert.ok(page.items().length >= 1);
  assert.equal(page.legend().length, 2);
  page.legend()[1].click();
  assert.equal(page.el("card-overlay").hidden, false);
  assert.equal(page.frames.pending(), false);
});

// ----------------------------------------------------------------- OF-15

test("OF-15: history is not replayed - on the first load the queue is empty and everybody sits; the routes of the next poll are queued and walk", async () => {
  const j = journal();
  j.sessionStart("S1");
  launch(j, "S1", "a1", "Explore");
  j.subStop("S1", "a1", "Explore");
  const page = makePage({ entries: [...j.entries] });
  await page.start();
  assert.ok(page.app.getOffice().routes.length >= 2);
  for (const p of page.app.getSim().positions()) {
    assert.equal(p.state, "seated");
    assert.equal(p.queued, 0);
  }
  launch(j, "S1", "a2", "Plan");
  await page.push(...j.entries.slice(-2));
  const walking = page.app
    .getSim()
    .positions()
    .filter((p) => p.state === "walking" || p.queued > 0);
  assert.ok(walking.length >= 1, "the new route is queued");
  page.frames.run(2000, 1000 / 60);
  for (const p of page.app.getSim().positions())
    assert.equal(p.state, "seated");
});

// ----------------------------------------------------------------- OF-16

test("OF-16: the legend - a button per character in the order of the desks; the name in plain words and the state; data-color only on the working ones, equal to the colour; the state changes at once", async () => {
  const j = journal();
  j.sessionStart("S1");
  launch(j, "S1", "a1", "Sai Orchestrator (ORCH)");
  launch(j, "S1", "a2", "Explore");
  j.subStop("S1", "a2", "Explore");
  const page = makePage({ entries: [...j.entries] });
  await page.start();
  const read = () =>
    page.legend().map((b) => ({
      name: b.byClass("name")[0].textContent,
      state: b.byClass("state")[0].textContent,
      color: b.byClass("swatch")[0].dataset.color,
    }));
  assert.deepEqual(read(), [
    { name: "Основная сессия", state: LEGEND_IDLE_MAIN, color: undefined },
    // REQ-048: the name in plain words
    { name: "Оркестратор", state: LEGEND_WORKING, color: "1" },
    { name: "Explore", state: LEGEND_IDLE, color: undefined },
  ]);
  j.prompt("S1");
  await page.push(j.entries[j.entries.length - 1]);
  assert.deepEqual(read()[0], {
    name: "Основная сессия",
    state: LEGEND_WORKING,
    color: "0",
  });
  j.subStop("S1", "a1", "Sai Orchestrator (ORCH)");
  await page.push(j.entries[j.entries.length - 1]);
  assert.deepEqual(read()[1], {
    name: "Оркестратор",
    state: LEGEND_IDLE,
    color: undefined,
  });
  j.stop("S1");
  await page.push(j.entries[j.entries.length - 1]);
  assert.equal(read()[0].state, LEGEND_IDLE_MAIN);
});

// ----------------------------------------------------------------- OF-17

function reportIo() {
  const io = {
    out: "",
    err: "",
    stdout: { write: (s) => (io.out += s) },
    stderr: { write: (s) => (io.err += s) },
  };
  return io;
}

function failure(argv, code, journalFile) {
  const io = reportIo();
  const before =
    journalFile &&
    fs.existsSync(journalFile) &&
    fs.statSync(journalFile).isFile()
      ? sha256File(journalFile)
      : null;
  const got = runReport(argv, io);
  assert.equal(got, code, `${argv.join(" ")}: ${io.err}`);
  assert.equal(io.out, "");
  assert.match(io.err, /[А-Яа-я]/);
  assert.equal(/^\s+at /m.test(io.err), false);
  if (before !== null) assert.equal(sha256File(journalFile), before);
}

test("OF-17a: wrong use - code 2, Russian message, empty stdout", () => {
  for (const argv of [
    [],
    ["--bogus"],
    ["--journal"],
    ["--journal", "x", "--journal", "y"],
    ["--journal", ""],
    ["--journal", "x", "word"],
    ["--session", "S1"],
    ["--journal", "x", "--session", "a", "--session", "b"],
  ]) {
    failure(argv, 2);
  }
});

test("OF-17b: no file - code 1", (t) => {
  failure(["--journal", path.join(sandbox(t).root, "nothing.jsonl")], 1);
});

test("OF-17c: a directory instead of a file - code 1", (t) => {
  failure(["--journal", sandbox(t).root], 1);
});

test("OF-17d: an unreadable file - code 1, the journal is not changed", (t) => {
  const box = sandbox(t);
  const file = writeJournal(box, twoSessions().entries);
  fs.chmodSync(file, 0o000);
  const io = reportIo();
  assert.equal(runReport(["--journal", file], io), 1);
  assert.equal(io.out, "");
  assert.match(io.err, /[А-Яа-я]/);
  fs.chmodSync(file, 0o600);
  assert.ok(fs.statSync(file).size > 0);
});

test("OF-17e: an empty journal and a session that is not there - code 1, the journal is not changed", (t) => {
  const box = sandbox(t);
  const empty = writeJournal(box, []);
  failure(["--journal", empty], 1, empty);
  const file = writeJournal(sandbox(t), twoSessions().entries);
  failure(["--journal", file, "--session", "NO-SUCH"], 1, file);
  const junk = path.join(box.dir, "junk.jsonl");
  fs.writeFileSync(junk, "not json\n{bad\n");
  failure(["--journal", junk], 1, junk);
});

test("OF-17f: corrupted lines among good ones - code 0 and skipped_lines (E30)", (t) => {
  const box = sandbox(t);
  const j = twoSessions();
  const file = writeJournal(box, j.entries.slice(0, 3));
  fs.appendFileSync(file, "{broken\n");
  fs.appendFileSync(file, `${JSON.stringify(j.entries[3])}\n`);
  const io = reportIo();
  assert.equal(runReport(["--journal", file], io), 0);
  const rep = JSON.parse(io.out);
  assert.equal(rep.skipped_lines, 1);
  assert.match(io.err, /[А-Яа-я]/);
});

// ----------------------------------------------------------------- OF-18

test("OF-18: Sim.sync - a walker in the middle of a route stays; a character without movement is re-seated when its desk changes; a character that lost trust is removed and the result that waited for it starts; a new grid recalculates the rest of the path", () => {
  // 1. a poll that brings foreign events and a new role does not touch a walker
  const j = journal();
  j.sessionStart("S1");
  launch(j, "S1", "a1", "Explore");
  const sim = createSim();
  let o = mk(j.entries).o;
  sim.sync(o);
  sim.enqueue(o.routes);
  sim.tick(0.4);
  const before = sim.positions().find((p) => p.key === "main");
  assert.equal(before.state, "walking");
  launch(j, "S1", "a2", "Plan");
  j.prompt("S1");
  o = mk(j.entries).o;
  sim.sync(o);
  sim.enqueue(o.routes);
  const after = sim.positions().find((p) => p.key === "main");
  assert.deepEqual(
    [after.x, after.y, after.route],
    [before.x, before.y, before.route],
  );
  assert.equal(after.queued, 1, "only the new route is queued, no doubles");
  // 2. a character without movement whose desk changed is re-seated
  const e = journal();
  e.sessionStart("S1");
  e.subStart("S1", "a1", "Explore");
  e.subStart("S1", "a2", "Plan");
  const s2 = createSim();
  s2.sync(mk(e.entries).o);
  const planBefore = s2.positions().find((p) => p.key === "role:Plan");
  assert.equal(planBefore.desk_index, 2);
  const lost = e.entries.map((x) =>
    x.agent_id === "a1" ? { ...x, source: "SIMULATION" } : x,
  );
  const o2 = mk(lost).o;
  s2.sync(o2);
  const planAfter = s2.positions().find((p) => p.key === "role:Plan");
  assert.equal(planAfter.desk_index, 1);
  assert.deepEqual([planAfter.x, planAfter.y], o2.layout.desks[1].seat);
  assert.equal(
    s2.positions().some((p) => p.key === "role:Explore"),
    false,
    "the character that lost trust is removed",
  );
  // 3. the result that waited for a removed character starts
  const w = journal();
  w.sessionStart("S1");
  launch(w, "S1", "L", "Lead");
  launch(w, "S1", "T", "Target", { byId: "L", byType: "Lead" });
  w.subStop("S1", "T", "Target");
  const s3 = createSim();
  const o3 = mk(w.entries).o;
  s3.sync(o3);
  s3.enqueue(o3.routes);
  s3.tick(0.1);
  const waiting = s3.positions().find((p) => p.key === "role:Target");
  assert.equal(waiting.state, "waiting");
  const gone = w.entries.map((x) =>
    x.agent_id === "L" && x.hook_event_name === "SubagentStart"
      ? { ...x, source: "SIMULATION" }
      : x,
  );
  const o3b = mk(gone).o;
  s3.sync(o3b);
  s3.tick(0.1);
  assert.equal(
    s3.positions().find((p) => p.key === "role:Target").state,
    "walking",
  );
  assert.equal(
    s3.positions().some((p) => p.key === "role:Lead"),
    false,
  );
  // 4. a new grid closes a step of the rest of the path of a walker. A
  // partition never closes a path any more (design 4.15, 3), so the change of
  // the grid is modelled by a step function of createSim (as in OF-09): with
  // the new grid object (after a poll with a new role) it closes one cell.
  const chars2 = (n) =>
    Array.from({ length: n }, (_v, i) => ({
      key: i === 0 ? "main" : `role:r${i}`,
      kind: i === 0 ? "main" : "role",
      desk_index: i,
    }));
  const route = (layout) => ({
    id: "9:handoff",
    event_index: 9,
    kind: "handoff",
    walker: "role:r1",
    target: "main",
    after: null,
    from_cell: [...layout.desks[1].seat],
    to_cell: [18, 4],
  });
  const small = { layout: buildLayout(2), characters: chars2(2), routes: [] };
  const big = { layout: buildLayout(3), characters: chars2(3), routes: [] };
  const steadyPath = findPath(
    small.layout,
    small.layout.desks[1].seat,
    [18, 4],
  );
  assert.ok(steadyPath.length > 8, "a long enough path");
  // a cell well after the place of the walker when the grid changes
  const closedCell = steadyPath[steadyPath.length - 3];
  const stepWith = (closed) => (l, x, y, nx, ny) =>
    !(l === big.layout && nx === closed[0] && ny === closed[1]) &&
    canStep(l, x, y, nx, ny);
  const runWalk = (growAt, closed) => {
    const step = stepWith(closed);
    const sim = createSim({ canStep: step });
    sim.sync(small);
    sim.enqueue([route(small.layout)]);
    const cells = [];
    let layout = small.layout;
    for (let i = 0; i < 6000; i++) {
      if (i === growAt) {
        layout = big.layout;
        sim.sync(big);
      }
      sim.tick(1 / 60);
      const c = sim.cell("role:r1");
      const prev = cells[cells.length - 1];
      if (prev && (prev[0] !== c[0] || prev[1] !== c[1])) {
        assert.equal(
          step(layout, prev[0], prev[1], c[0], c[1]),
          true,
          `a step into a closed cell at frame ${i}: ${prev} -> ${c}`,
        );
      }
      cells.push(c);
      if (i > 60 && sim.positions().every((p) => p.state === "seated")) break;
    }
    const seat = layout.desks[1].seat;
    assert.deepEqual(sim.cell("role:r1"), seat, "the walker came home");
    return cells;
  };
  const grown = runWalk(30, closedCell);
  const steady = runWalk(-1, closedCell);
  assert.ok(
    steady.some((c) => c[0] === closedCell[0] && c[1] === closedCell[1]),
    "without the new grid the walker passes the cell",
  );
  assert.ok(
    grown.every((c) => c[0] !== closedCell[0] || c[1] !== closedCell[1]),
    "with the new grid the walker never enters the closed cell",
  );
  assert.notDeepEqual(grown, steady, "the new grid changed the path");
  // a new grid that does not close the path leaves it as it was
  const away = [22, 15];
  assert.ok(steadyPath.every((c) => c[0] !== away[0] || c[1] !== away[1]));
  const key = (cells) => cells.map((c) => c.join(","));
  assert.deepEqual(key(runWalk(20, away)), key(runWalk(-1, away)));
});

// ----------------------------------------------------------------- OF-19

test("OF-19: captions - the rule roleLabel (at most 16 code points on real agent_type and the three built-in types; the examples; brackets; one caption for two roles of different folders); the caption of the frame is the name at the desk, fillText(name, X + 12, Y + 31) with centered text", () => {
  for (const name of [...agentNames(), "general-purpose", "Explore", "Plan"]) {
    assert.ok(Array.from(roleLabel(name)).length <= 16, name);
  }
  assert.equal(
    roleLabel("Sai Code Design Validator (CODE-DESIGN-VALIDATOR)"),
    "CODE-DESIGN-VAL…",
  );
  assert.equal(roleLabel("Sai Orchestrator (ORCH)"), "ORCH");
  assert.equal(roleLabel("Explore"), "Explore");
  assert.equal(roleLabel("foo (a (b))"), "foo (a (b))");
  assert.equal(roleLabel("foo (bar"), "foo (bar");
  assert.equal(roleLabel("A (X)"), roleLabel("B (X)"));
  const j = journal();
  j.sessionStart("S1");
  launch(j, "S1", "a1", "Sai Orchestrator (ORCH)");
  const { o } = mk(j.entries);
  const ctx = makeCtx();
  const seat = o.layout.desks[1].seat;
  drawOffice(ctx, o, {
    positions: [
      {
        key: "role:Sai Orchestrator (ORCH)",
        x: seat[0],
        y: seat[1],
        state: "seated",
      },
    ],
    selectedKey: null,
    bubbles: new Map(),
    cellPx: 24,
  });
  // REQ-048: the caption of the frame is the name of the role at its desk; a
  // line not wider than 130 is drawn without maxWidth
  const call = ctx.calls.find(
    (c) =>
      c.op === "fillText" &&
      c.args[0] === "Оркестратор" &&
      c.font === LABEL_FONT,
  );
  assert.deepEqual(call.args, [
    "Оркестратор",
    seat[0] * 24 + 12,
    seat[1] * 24 + 31,
  ]);
  assert.equal(
    ctx.calls.some((c) => c.op === "fillText" && c.args[0] === "ORCH"),
    false,
  );
  assert.equal(call.textAlign, "center");
  assert.equal(call.font, LABEL_FONT);
});

// ----------------------------------------------------------------- OF-20

test("OF-20: a click - canvasPoint on a scaled canvas with min_x = 5 and min_x = -6; hitTest limits and ties; a click beside clears the choice and opens no card", async () => {
  for (const [desks, minX] of [
    [19, 5],
    [29, -6],
  ]) {
    const grid = buildLayout(desks);
    assert.equal(grid.min_x, minX);
    // the canvas at 48 px per cell shown at half its size
    const canvas = {
      width: grid.width * 48,
      height: grid.height * 48,
      getBoundingClientRect: () => ({
        left: 10,
        top: 20,
        width: grid.width * 24,
        height: grid.height * 24,
      }),
    };
    const p = canvasPoint(
      { clientX: 10 + 360, clientY: 20 + 225 },
      canvas,
      grid,
      48,
    );
    assert.equal(p.px, 360 + minX * 24);
    assert.equal(p.py, 225);
  }
  const layout = buildLayout(29);
  const zero = {
    width: 100,
    height: 100,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 0, height: 0 }),
  };
  assert.ok(
    Number.isNaN(canvasPoint({ clientX: 5, clientY: 5 }, zero, layout, 24).px),
  );
  const pos = [
    { key: "a", x: 5, y: 5, desk_index: 3 },
    { key: "b", x: 5, y: 5, desk_index: 1 },
  ];
  const cx = 5.5 * 24;
  const cy = 5.5 * 24;
  assert.equal(hitTest(pos, cx, cy), "b", "a tie goes to the smaller desk");
  assert.equal(hitTest(pos, cx + 0.89 * 24, cy), "b");
  assert.equal(hitTest(pos, cx + 0.91 * 24, cy), null);
  assert.equal(hitTest(pos, cx, cy + 1.09 * 24), "b");
  assert.equal(hitTest(pos, cx, cy + 1.11 * 24), null);
  assert.equal(hitTest([], 1, 1), null);
  const j = journal();
  j.sessionStart("S1");
  launch(j, "S1", "a1", "Explore");
  const page = makePage({ entries: [...j.entries] });
  await page.start();
  clickCharacter(page, "role:Explore");
  assert.equal(page.el("card-overlay").hidden, false);
  page.canvas.rect = {
    left: 0,
    top: 0,
    width: page.canvas.width,
    height: page.canvas.height,
  };
  page.canvas.click({
    clientX: page.canvas.width - 20,
    clientY: page.canvas.height - 10,
  });
  assert.equal(page.el("card-overlay").hidden, true);
  assert.equal(
    page.legend().every((b) => b.getAttribute("aria-pressed") === "false"),
    true,
  );
});

// ----------------------------------------------------------------- OF-21

test("OF-21: data-drawn - absent before the first drawing, the number of characters after it, updated on a poll tick without frames; a throwing context leaves it as it was, the panels live, one console.error per message, frames and polling go on", async () => {
  const errors = mock.method(console, "error", () => {});
  try {
    const j = journal();
    j.sessionStart("S1");
    const page = makePage({ entries: [...j.entries] });
    await page.start();
    assert.equal(page.canvas.hasAttribute("data-drawn"), false);
    page.frames.step();
    assert.equal(page.canvas.dataset.drawn, "1");
    launch(j, "S1", "a1", "Explore");
    await page.push(...j.entries.slice(1));
    await page.tick(2000);
    assert.equal(
      page.canvas.dataset.drawn,
      "2",
      "drawn on the tick of the poll, without a frame",
    );
    // a context that throws
    page.ctx.fail = new Error("canvas broke");
    launch(j, "S1", "a2", "Plan");
    await page.push(...j.entries.slice(-2));
    page.frames.run(5);
    await page.tick(2000);
    assert.equal(page.canvas.dataset.drawn, "2");
    assert.ok(page.rows().length >= 5, "the journal is in place");
    assert.ok(page.items().length >= 2, "the task panel is in place");
    const lines = errors.mock.calls
      .map((c) => c.arguments.join(" "))
      .filter((l) => l.includes("canvas broke"));
    assert.equal(lines.length, 1);
    assert.equal(page.frames.pending(), true, "the frames go on");
    const calls = page.server.calls.length;
    await page.tick(2000);
    assert.ok(page.server.calls.length > calls, "the polling goes on");
    page.ctx.fail = null;
    page.frames.step();
    assert.equal(page.canvas.dataset.drawn, "3");
  } finally {
    errors.mock.restore();
  }
});

// ----------------------------------------------------------------- OF-23/24

test("OF-23: the card of the main session says the number of running sessions and no 'в работе'; the card of an instance has no 'в работе: M', its workplace row names the number", async () => {
  const j = journal();
  j.sessionStart("S1");
  j.sessionStart("S2");
  launch(j, "S1", "a1", "Explore");
  const page = makePage({ entries: [...j.entries] });
  await page.start();
  page.legend()[0].click();
  const main = page.el("card").byClass("card-working")[0].textContent;
  assert.equal(main, `${CARD_SESSIONS}2`);
  assert.equal(main.includes("в работе"), false);
  page.legend()[1].click();
  // REQ-044: the card of an instance has no "в работе: M"; its workplace
  // line names the number
  assert.equal(page.el("card").byClass("card-working").length, 0);
  assert.equal(page.el("card").textContent.includes("в работе: "), false);
  assert.equal(workplaceOf(page), "работает — у этой роли задач «в работе»: 1");
});

test("OF-24: Sim.positions carries desk_index of every character, in the order of the desks", () => {
  const j = rolesJournal(6);
  const { o } = mk(j.entries);
  const sim = createSim();
  sim.sync(o);
  assert.deepEqual(
    sim.positions().map((p) => p.desk_index),
    [0, 1, 2, 3, 4, 5, 6],
  );
});

// ----------------------------------------------------------------- OF-25

test("OF-25: office-report - with --session the counters, working and routes follow the tasks of that session while desk_index and cells are as without it; wrong use; a torn last line is not a line; runReport and buildReport are called", (t) => {
  const box = sandbox(t);
  const j = twoSessions();
  const file = writeJournal(box, j.entries);
  // the clock is a parameter (REQ-042 design P9): the journal of 2026 is read
  // at a fixed moment, not at today's date
  const clock = () => NOW;
  const io = reportIo();
  assert.equal(runReport(["--journal", file, "--session", "S2"], io, clock), 0);
  const s2 = JSON.parse(io.out);
  const io2 = reportIo();
  assert.equal(runReport(["--journal", file], io2, clock), 0);
  const all = JSON.parse(io2.out);
  const roleS2 = s2.roles.find((r) => r.role === "Explore");
  const roleAll = all.roles.find((r) => r.role === "Explore");
  assert.equal(roleS2.desk_index, roleAll.desk_index);
  assert.equal(typeof roleS2.desk_index, "number");
  assert.equal(s2.roles.length, 1);
  assert.equal(s2.routes.length, 1);
  const wholeHandoff = all.routes.find((r) => r.target === "role:Explore");
  assert.deepEqual(s2.routes[0].from_cell, wholeHandoff.from_cell);
  assert.deepEqual(s2.routes[0].to_cell, wholeHandoff.to_cell);
  assert.equal(s2.main.working, true, "the row of S2 is open");
  assert.equal(all.main.working, true);
  // wrong use
  for (const argv of [
    ["--journal", file, "--journal", file],
    ["--journal", ""],
    ["--journal", file, "extra"],
  ]) {
    assert.equal(runReport(argv, reportIo()), 2);
  }
  // a torn last line is not counted
  const torn = path.join(box.dir, "torn.jsonl");
  fs.writeFileSync(torn, `${JSON.stringify(j.entries[0])}\n{"time":"x`);
  const io3 = reportIo();
  assert.equal(runReport(["--journal", torn], io3), 0);
  const tornReport = JSON.parse(io3.out);
  assert.equal(tornReport.events, 1);
  assert.equal(tornReport.skipped_lines, 0);
  // buildReport directly
  const direct = buildReport(j.entries, [], NOW, "S1");
  assert.equal(direct.roles.length, 1);
  assert.equal(direct.session, "S1");
});

// ----------------------------------------------------------------- OF-26

test("OF-26: colours - colorOfDesk(0) = 0 and 1 + ((d - 1) mod 11); the palette of 12; the body, the screen, the bubble frame and the board column take it; style.css has the rules for 0..11", async () => {
  assert.equal(colorOfDesk(0), 0);
  for (let d = 1; d <= 30; d++)
    assert.equal(colorOfDesk(d), 1 + ((d - 1) % 11), `d=${d}`);
  assert.deepEqual([...ROLE_PALETTE], PALETTE);
  const j = journal();
  j.sessionStart("S1");
  launch(j, "S1", "a1", "Explore");
  const { o } = mk(j.entries);
  const ch = charOf(o, "role:Explore");
  assert.equal(ch.color, 1);
  const ctx = makeCtx();
  const seat = o.layout.desks[1].seat;
  const bubbles = bubblesAt(o, T0 + 4000);
  drawOffice(ctx, o, {
    positions: [
      { key: "role:Explore", x: seat[0], y: seat[1], state: "seated" },
    ],
    selectedKey: null,
    bubbles,
    cellPx: 24,
  });
  const color = PALETTE[1];
  assert.ok(
    ctx.calls.some(
      (c) =>
        c.op === "fillRect" &&
        c.fillStyle === color &&
        c.args[2] === 12 &&
        c.args[3] === 11,
    ),
    "body",
  );
  assert.ok(
    ctx.calls.some(
      (c) =>
        c.op === "fillRect" &&
        c.fillStyle === color &&
        c.args[2] === 16 &&
        c.args[3] === 11,
    ),
    "screen",
  );
  assert.ok(
    ctx.calls.some((c) => c.op === "stroke" && c.strokeStyle === color),
    "bubble frame",
  );
  assert.ok(
    ctx.calls.some(
      (c) =>
        c.op === "fillRect" &&
        c.fillStyle === color &&
        c.args[0] === 676 &&
        c.args[2] === 54,
    ),
    "board column (REQ-048: 54 wide)",
  );
  const css = fs.readFileSync(path.join(PUBLIC, "style.css"), "utf8");
  for (let n = 0; n <= 11; n++) {
    const swatch = new RegExp(
      `\\.swatch\\[data-color="${n}"\\][^{]*\\{[^}]*${PALETTE[n]}`,
      "i",
    );
    const cardSwatch = new RegExp(
      `\\.card-swatch\\[data-color="${n}"\\][^{]*\\{[^}]*${PALETTE[n]}`,
      "i",
    );
    const itemRole = new RegExp(
      `\\.item-role\\[data-color="${n}"\\][^{]*\\{[^}]*${PALETTE[n]}`,
      "i",
    );
    assert.match(css, swatch, `.swatch ${n}`);
    assert.match(css, cardSwatch, `.card-swatch ${n}`);
    assert.match(css, itemRole, `.item-role ${n}`);
  }
});

// ----------------------------------------------------------------- OF-27

const screenRect = (o, deskIndex) => {
  const [bx, by] = o.layout.desks[deskIndex].block;
  return [bx * 24 + 23, by * 24 + 5, 16, 11].join(",");
};
const screenColor = (ctx, o, deskIndex) => {
  const want = screenRect(o, deskIndex);
  const c = ctx
    .lastFrame()
    .find((x) => x.op === "fillRect" && x.args.join(",") === want);
  return c === undefined ? undefined : c.fillStyle;
};
const frameOf = (o) => {
  const ctx = makeCtx();
  drawOffice(ctx, o, {
    positions: [],
    selectedKey: null,
    bubbles: new Map(),
    cellPx: 24,
  });
  return ctx;
};

test("OF-27: the screen of a laptop - the colour of the role at a working desk, #111d2e at others; 'окончание не записано' does not light it; the main session's screen lights while its row is open; it goes dark at once after the end", () => {
  const j = journal();
  j.sessionStart("S1");
  j.prompt("S1");
  launch(j, "S1", "a1", "Explore");
  launch(j, "S1", "a2", "Plan");
  j.subStop("S1", "a2", "Plan");
  let { o } = mk(j.entries);
  let ctx = frameOf(o);
  assert.equal(screenColor(ctx, o, 0), PALETTE[0], "main");
  assert.equal(screenColor(ctx, o, 1), PALETTE[1], "Explore");
  assert.equal(screenColor(ctx, o, 2), "#111d2e", "Plan");
  j.stop("S1");
  j.subStop("S1", "a1", "Explore");
  o = mk(j.entries).o;
  ctx = frameOf(o);
  for (const d of [0, 1, 2])
    assert.equal(
      screenColor(ctx, o, d),
      "#111d2e",
      `desk ${d} is dark at once`,
    );
  const u = mk(j.entries.slice(0, 4), [{ time: at(99), journal_lines: 4 }]);
  ctx = frameOf(u.o);
  assert.equal(
    screenColor(ctx, u.o, 1),
    "#111d2e",
    "unrecorded does not light",
  );
});

// ----------------------------------------------------------------- OF-28

test("OF-28: bubbles - the four phrases over the right character at the moment of the event and at 10 s, none at 10 001 ms or before the event; a line received 30 s late gives none; no bubble for the listed events; the later event wins; all texts are the four constants; pause and speed change nothing", async () => {
  // REQ-042 criterion 8: the event of an end proves the end of work, not its
  // success - the phrases are written here as literals, not read from the
  // constants being tested.
  assert.deepEqual(
    { ...BUBBLE_TEXTS },
    {
      got_task: "Только что получил задачу",
      done: "Закончил работу",
      got_request: "Получил запрос",
      answer_ready: "Вернул ответ",
    },
  );
  const texts = new Set([
    "Только что получил задачу",
    "Закончил работу",
    "Получил запрос",
    "Вернул ответ",
  ]);
  const seen = new Set();
  const look = (o, ms, key) => {
    const b = bubblesAt(o, ms).get(key);
    if (b !== undefined) seen.add(b.text);
    return b === undefined ? undefined : b.text;
  };
  const j = journal();
  j.sessionStart("S1");
  j.time(100);
  const prompt = j.prompt("S1");
  j.time(200);
  launch(j, "S1", "a1", "Explore");
  const start = j.entries.findIndex(
    (e) => e.hook_event_name === "SubagentStart",
  );
  j.time(300);
  const stop = j.stop("S1");
  j.time(400);
  const subStop = j.subStop("S1", "a1", "Explore");
  const { o } = mk(j.entries);
  const t = (i) => Date.parse(j.entries[i].time);
  const cases = [
    [prompt, "main", BUBBLE_TEXTS.got_request],
    [start, "role:Explore", BUBBLE_TEXTS.got_task],
    [stop, "main", "Вернул ответ"],
    [subStop, "role:Explore", "Закончил работу"],
  ];
  for (const [index, key, text] of cases) {
    const when = t(index);
    assert.equal(look(o, when, key), text, `${text} at the event`);
    assert.equal(look(o, when + 10_000, key), text, `${text} at 10 s`);
    assert.notEqual(look(o, when + 10_001, key), text, `${text} at 10 001 ms`);
    assert.notEqual(look(o, when + 11_000, key), text, `${text} at 11 s`);
    assert.notEqual(look(o, when - 1, key), text, `${text} before the event`);
  }
  // the later event of one character wins
  const two = journal();
  two.sessionStart("S1");
  two.time(500);
  two.prompt("S1");
  two.time(503);
  two.stop("S1");
  assert.equal(look(mk(two.entries).o, T0 + 504_000, "main"), "Вернул ответ");
  // no bubble: Stop without an open row, an end without a start, SessionEnd, PostToolUse, a marked line
  const n = journal();
  n.sessionStart("S1");
  n.time(1000);
  n.stop("S1");
  n.subStop("S1", "ghost", "X");
  n.sessionEnd("S1");
  n.post("S1", "tu", "zz", { subagentType: "X" });
  n.raw({
    ...entryOf("UserPromptSubmit", "S1", at(1010)),
    source: "SIMULATION",
  });
  const none = mk(n.entries).o;
  for (let ms = T0; ms <= T0 + 1_100_000; ms += 7000) {
    assert.equal(bubblesAt(none, ms).size, 0, `at ${ms}`);
  }
  // a repeated start of a task gives no second "got a task"
  const rep = journal();
  rep.sessionStart("S1");
  rep.time(100);
  rep.subStart("S1", "a1", "Explore");
  rep.time(1000);
  const again = rep.subStart("S1", "a1", "Explore");
  const ro = mk(rep.entries).o;
  assert.notEqual(
    look(ro, t2(rep, again) + 1000, "role:Explore"),
    BUBBLE_TEXTS.got_task,
  );
  // a line received 30 s after its time gives no bubble
  const late = makePage({ entries: [], now: T0 + 31_000 });
  await late.start();
  late.server.entries.push(
    entryOf("SessionStart", "S1", at(1)),
    entryOf("UserPromptSubmit", "S1", at(2)),
  );
  await late.tick(2000);
  assert.equal(bubblesAt(late.app.getOffice(), late.clock.now()).size, 0);
  for (const s of seen) assert.ok(texts.has(s), `foreign text ${s}`);
  assert.equal(seen.size, 4);
  // pause and speed do not change bubbles
  const live = makePage({ entries: [], now: T0 + 3000 });
  await live.start();
  live.server.entries.push(
    entryOf("SessionStart", "S1", at(1)),
    entryOf("UserPromptSubmit", "S1", at(2)),
  );
  await live.tick(2000);
  live.app.setPaused(true);
  live.app.setSpeed(4);
  live.frames.step();
  assert.ok(
    live.ctx
      .lastFrame()
      .some(
        (c) => c.op === "fillText" && c.args[0] === BUBBLE_TEXTS.got_request,
      ),
  );
});

function t2(j, index) {
  return Date.parse(j.entries[index].time);
}

// ----------------------------------------------------------------- OF-29/30

function simWithRoute() {
  const j = journal();
  j.sessionStart("S1");
  launch(j, "S1", "a1", "Explore");
  const { o } = mk(j.entries);
  const sim = createSim();
  sim.sync(o);
  return { sim, o };
}

test("OF-29: a pause - in 10 s of frames nobody moves, an event at once changes the state, the screen and the legend; a new route waits in the queue; after 'Продолжить' it is walked and the character is on its seat; at opening there is no pause", async () => {
  const j = journal();
  j.sessionStart("S1");
  launch(j, "S1", "a1", "Explore");
  const page = makePage({ entries: [...j.entries] });
  await page.start();
  assert.equal(page.app.getSim().isPaused(), false);
  assert.equal(page.text("pause"), "Пауза");
  page.el("pause").click();
  assert.equal(page.app.getSim().isPaused(), true);
  assert.equal(page.text("pause"), "Продолжить");
  const still = JSON.stringify(page.app.getSim().positions());
  page.frames.run(600, 1000 / 60);
  assert.equal(JSON.stringify(page.app.getSim().positions()), still);
  launch(j, "S1", "a2", "Plan");
  await page.push(...j.entries.slice(-2));
  assert.equal(charOf(page.app.getOffice(), "role:Plan").working, true);
  assert.equal(
    page.legend().find((b) => b.dataset.key === "role:Plan").dataset.state,
    "working",
  );
  page.ctx.clear();
  page.frames.step();
  const plan = page.app.getOffice();
  assert.equal(
    screenColor(page.ctx, plan, charOf(plan, "role:Plan").desk_index),
    PALETTE[charOf(plan, "role:Plan").color],
  );
  const queued = page.app
    .getSim()
    .positions()
    .reduce((s, p) => s + p.queued + (p.state === "walking" ? 1 : 0), 0);
  assert.ok(queued >= 1, "the route stands in the queue");
  page.frames.run(600, 1000 / 60);
  assert.equal(
    page.app
      .getSim()
      .positions()
      .some((p) => p.state === "walking"),
    false,
    "nobody walks on a pause",
  );
  page.el("pause").click();
  page.frames.run(4000, 1000 / 60);
  for (const p of page.app.getSim().positions()) {
    assert.equal(p.state, "seated");
    const seat = page.app.getOffice().layout.desks[p.desk_index].seat;
    assert.deepEqual([p.x, p.y], seat);
  }
});

test("OF-30: speeds - the same path (there, standing, back) takes half and a quarter of the frames at 2x and 4x; at opening 1x; setSpeed(3) changes nothing", () => {
  const frames = (speed) => {
    const { sim, o } = simWithRoute();
    sim.setSpeed(speed);
    sim.enqueue(o.routes);
    let n = 0;
    while (n < 100_000) {
      sim.tick(1 / 60);
      n += 1;
      if (sim.positions().every((p) => p.state === "seated" && p.queued === 0))
        break;
    }
    return n;
  };
  const one = frames(1);
  assert.ok(Math.abs(frames(2) - one / 2) <= 1, `2x: ${frames(2)} vs ${one}`);
  assert.ok(Math.abs(frames(4) - one / 4) <= 1, `4x: ${frames(4)} vs ${one}`);
  const { sim } = simWithRoute();
  assert.equal(sim.getSpeed(), 1);
  sim.setSpeed(3);
  assert.equal(sim.getSpeed(), 1);
  assert.ok(SPEED > 0 && PAUSE > 0);
});

// ----------------------------------------------------------------- OF-31

test("OF-31: the board - columns only for roles of a running session, in the order of the desks, with the counts; seven roles give 3 columns and '+N'; no running session - no columns; it changes at once", () => {
  const j = journal();
  j.sessionStart("A");
  j.sessionStart("B");
  launch(j, "A", "a1", "Explore");
  launch(j, "A", "a2", "Plan");
  j.subStop("A", "a2", "Plan");
  launch(j, "B", "b1", "Other");
  j.sessionEnd("B");
  let { o } = mk(j.entries);
  assert.deepEqual(
    o.board.columns.map((c) => c.key),
    ["role:Explore", "role:Plan"],
  );
  // REQ-042: the counts have the five states
  assert.deepEqual(o.board.columns[0].counts, {
    in_progress: 1,
    stale: 0,
    restarted: 0,
    completed: 0,
    unrecorded: 0,
  });
  assert.deepEqual(o.board.columns[1].counts, {
    in_progress: 0,
    stale: 0,
    restarted: 0,
    completed: 1,
    unrecorded: 0,
  });
  assert.equal(o.board.more, 0);
  const unrec = mk(j.entries, [{ time: at(99), journal_lines: 7 }]);
  assert.equal(unrec.o.board.columns.length, 0, "no running session");
  // a session older than STALE_AFTER_MS is not running: no columns (REQ-007
  // criterion 1 as changed by REQ-042); exactly on the threshold it still runs
  const lastA = Date.parse(at(7));
  assert.equal(
    mk(j.entries, [], lastA + STALE_AFTER_MS).o.board.columns.length,
    2,
  );
  assert.equal(
    mk(j.entries, [], lastA + STALE_AFTER_MS + 1).o.board.columns.length,
    0,
    "no running session: its last event is older than the threshold",
  );
  // five roles
  const f = journal();
  f.sessionStart("A");
  for (let i = 0; i < 7; i++) launch(f, "A", `r${i}`, `Role ${i}`);
  o = mk(f.entries).o;
  // REQ-048: three columns of the names (D4), the rest counted in "+N"
  assert.equal(o.board.columns.length, 3);
  assert.equal(o.board.more, 4);
  const ctx = frameOf(o);
  const plus = ctx.calls.find((c) => c.op === "fillText" && c.args[0] === "+4");
  assert.deepEqual(plus.args.slice(1), [852, 40, 16]);
  // after the end of the last running session
  f.sessionEnd("A");
  o = mk(f.entries).o;
  assert.equal(o.board.columns.length, 0);
  assert.equal(o.board.more, 0);
});

// ----------------------------------------------------------------- OF-32

function fixedCalls(ctx) {
  const out = [];
  const board = (kind) => kind === "board";
  const layout = buildLayout(0);
  for (const [x, y] of FIXED_CELLS) {
    if (board(cellKind(layout, x, y))) continue;
    const inside = ctx.calls.filter((c) => {
      if (c.op !== "fillRect") return false;
      const [rx, ry, w, h] = c.args;
      return (
        rx >= x * 24 &&
        ry >= y * 24 &&
        rx + w <= (x + 1) * 24 &&
        ry + h <= (y + 1) * 24
      );
    });
    out.push(JSON.stringify([x, y, inside.map((c) => [c.args, c.fillStyle])]));
  }
  const labels = ctx.calls.filter(
    (c) =>
      c.op === "fillText" && Object.values(ROOM_LABELS).includes(c.args[0]),
  );
  out.push(JSON.stringify(labels.map((c) => c.args)));
  return out;
}

test("OF-32: the fixed layer does not depend on the journal or the time - the same calls for an empty journal and K + 3 roles, and for one journal a minute apart", () => {
  const draw = (entries, now) => {
    const { o } = mk(entries, [], now);
    const ctx = makeCtx();
    const positions = o.characters.map((c) => ({
      key: c.key,
      x: o.layout.desks[c.desk_index].seat[0],
      y: o.layout.desks[c.desk_index].seat[1],
      state: "seated",
    }));
    drawOffice(ctx, o, {
      positions,
      selectedKey: null,
      bubbles: bubblesAt(o, now),
      cellPx: 24,
    });
    return ctx;
  };
  const empty = fixedCalls(draw([], NOW));
  const full = rolesJournal(K + 3);
  const withBubbles = draw(full.entries, T0 + 5000);
  assert.ok(
    withBubbles.calls.some((c) => c.op === "roundRect"),
    "a bubble is on the first frame",
  );
  assert.deepEqual(fixedCalls(withBubbles), empty);
  assert.deepEqual(fixedCalls(draw(full.entries, T0 + 65_000)), empty);
  assert.ok(empty.length > 50);
  // the chairs of the hall and of the meeting room are drawn (criterion 12)
  const ctx0 = draw([], NOW);
  for (const [x, y] of [
    [28, 6],
    [30, 6],
    [32, 6],
    [34, 6],
    [30, 20],
    [32, 20],
  ]) {
    assert.ok(
      ctx0.calls.some(
        (c) =>
          c.op === "fillRect" &&
          c.args.join(",") === [x * 24 + 4, y * 24 + 6, 16, 18].join(","),
      ),
      `a chair at ${x},${y}`,
    );
  }
});

// ----------------------------------------------------------------- OF-33

test("OF-33: in the full frame no wall, furniture or reserved cell has the colour of a character's body; characters are drawn only on seats", () => {
  const j = rolesJournal(K + 3, { stopped: true });
  j.sessionEnd("S0");
  const { o } = mk(j.entries);
  assert.equal(o.characters.length, K + 4);
  const ctx = makeCtx();
  const positions = o.characters.map((c) => ({
    key: c.key,
    x: o.layout.desks[c.desk_index].seat[0],
    y: o.layout.desks[c.desk_index].seat[1],
    state: "seated",
  }));
  drawOffice(ctx, o, {
    positions,
    selectedKey: null,
    bubbles: new Map(),
    cellPx: 24,
  });
  const bodies = ctx.calls.filter(
    (c) =>
      c.op === "fillRect" &&
      c.args[2] === 12 &&
      c.args[3] === 11 &&
      PALETTE.includes(c.fillStyle),
  );
  assert.equal(bodies.length, K + 4);
  for (const b of bodies) {
    const cell = [
      Math.floor((b.args[0] - 6) / 24),
      Math.floor((b.args[1] - 9) / 24),
    ];
    assert.equal(cellKind(o.layout, cell[0], cell[1]), "seat");
  }
  const solid = [
    "wall",
    "desk",
    "reserved",
    "table",
    "board",
    "counter",
    "server",
    "plant",
    "shelf",
    "chair",
    "partition",
  ];
  const frame = ctx.lastFrame();
  let checked = 0;
  for (let y = 0; y < o.layout.height; y++) {
    for (let x = o.layout.min_x; x <= o.layout.max_x; x++) {
      if (!solid.includes(cellKind(o.layout, x, y))) continue;
      checked += 1;
      let found = null;
      for (let i = frame.length - 1; i >= 0; i--) {
        const c = frame[i];
        if (c.op !== "fillRect") continue;
        const [rx, ry, w, h] = c.args;
        const px = x * 24 + 12;
        const py = y * 24 + 12;
        if (px >= rx && px < rx + w && py >= ry && py < ry + h) {
          found = c.fillStyle;
          break;
        }
      }
      assert.ok(found !== null, `cell ${x},${y}`);
      assert.equal(
        PALETTE.includes(found),
        false,
        `cell ${x},${y} has a character colour ${found}`,
      );
    }
  }
  assert.ok(checked > 300);
});

// ----------------------------------------------------------------- OF-34

test("OF-34: a bubble in the frame - width measureText + 14, height 18, centred above the cell, top 24 px above it; moved inside with a margin of 2 px at the edges; a later event is drawn later; the text is 10 px", () => {
  const j = journal();
  j.sessionStart("S1");
  j.prompt("S1");
  launch(j, "S1", "a1", "Explore");
  const { o } = mk(j.entries);
  const seat = o.layout.desks[1].seat;
  const bubbles = new Map([
    ["role:Explore", { text: BUBBLE_TEXTS.got_task, event_index: 5 }],
    ["main", { text: BUBBLE_TEXTS.got_request, event_index: 9 }],
  ]);
  const ctx = makeCtx();
  const mainSeat = o.layout.desks[0].seat;
  drawOffice(ctx, o, {
    positions: [
      { key: "main", x: mainSeat[0], y: mainSeat[1], state: "seated" },
      { key: "role:Explore", x: seat[0], y: seat[1], state: "seated" },
    ],
    selectedKey: null,
    bubbles,
    cellPx: 24,
  });
  const rrects = ctx.calls.filter((c) => c.op === "roundRect");
  assert.equal(rrects.length, 2);
  const w = (text) => Math.min(0.6 * 10 * Array.from(text).length, 125) + 14;
  const first = rrects[0].args;
  assert.equal(first[2], w(BUBBLE_TEXTS.got_task), "the earlier event first");
  assert.equal(first[3], 18);
  assert.equal(first[0], seat[0] * 24 + 12 - first[2] / 2);
  assert.equal(first[1], seat[1] * 24 - 24);
  const texts = ctx.calls.filter(
    (c) =>
      c.op === "fillText" && Object.values(BUBBLE_TEXTS).includes(c.args[0]),
  );
  assert.equal(texts.length, 2);
  assert.equal(texts[0].font, "10px system-ui");
  assert.equal(first[2], 139, "a wide text is limited to 125 + 14");
  assert.deepEqual(texts[0].args.slice(1), [first[0] + 7, first[1] + 12, 125]);
  assert.equal(
    rrects[1].args[2],
    w(BUBBLE_TEXTS.got_request),
    "a short phrase as before",
  );
  assert.equal(texts[1].args.length, 3, "a short phrase has no maxWidth");
  assert.equal(
    texts[1].args[0],
    BUBBLE_TEXTS.got_request,
    "the later event is drawn later",
  );
  // edges: an office with extra columns (29 desks, min_x = -6 < 0)
  const wide = buildLayout(29);
  assert.equal(wide.min_x, -6);
  const edge = (x, y) => {
    const c = makeCtx();
    drawOffice(
      c,
      {
        layout: wide,
        characters: [
          {
            key: "k",
            kind: "role",
            full: "k",
            label: "k",
            color: 1,
            working: false,
            working_count: 0,
            desk_index: 1,
          },
        ],
        board: { columns: [], more: 0 },
      },
      {
        positions: [{ key: "k", x, y, state: "seated" }],
        selectedKey: null,
        bubbles: new Map([
          ["k", { text: BUBBLE_TEXTS.got_task, event_index: 1 }],
        ]),
        cellPx: 24,
      },
    );
    return c.calls.find((q) => q.op === "roundRect").args;
  };
  assert.equal(edge(wide.min_x + 1, 8)[0], wide.min_x * 24 + 2, "left edge");
  assert.equal(edge(10, 1)[1], 2, "top edge");
  const right = edge(wide.max_x, 8);
  assert.equal(right[0] + right[2], (wide.max_x + 1) * 24 - 2, "right edge");
});

// ----------------------------------------------------------------- OF-35

test("OF-35: a frame of 2 s moves a character by at most 3.4 * m * 0.05 cells; at 4x at most 0.68 cell per frame", async () => {
  for (const m of [1, 2, 4]) {
    const j = journal();
    j.sessionStart("S1");
    launch(j, "S1", "a1", "Explore");
    const page = makePage({ entries: [...j.entries] });
    await page.start();
    launch(j, "S1", "a2", "Plan");
    await page.push(...j.entries.slice(-2));
    page.app.setSpeed(m);
    page.frames.step(16);
    const main = () =>
      page.app
        .getSim()
        .positions()
        .find((p) => p.key === "main");
    let prev = main();
    let moved = 0;
    for (let i = 0; i < 10; i++) {
      page.frames.step(2000);
      const now = main();
      moved = Math.max(moved, Math.hypot(now.x - prev.x, now.y - prev.y));
      prev = now;
    }
    assert.ok(moved > 0, `m=${m}: it moves`);
    assert.ok(moved <= 3.4 * m * 0.05 + 1e-6, `m=${m}: moved ${moved}`);
    if (m === 4) assert.ok(moved <= 0.68 + 1e-6);
  }
  await settle();
});

// ----------------------------------------------------- after the code fix

test("OF-34b: a bubble is never wider than 139 for any text; the text is narrowed by maxWidth 125 only when it is wider", () => {
  const j = journal();
  j.sessionStart("S1");
  const { o } = mk(j.entries);
  const seat = o.layout.desks[0].seat;
  for (const text of [
    "",
    "x",
    BUBBLE_TEXTS.done,
    BUBBLE_TEXTS.answer_ready,
    "w".repeat(20),
    "w".repeat(21),
    "Ж".repeat(300),
    "😀".repeat(80),
  ]) {
    const ctx = makeCtx();
    drawOffice(ctx, o, {
      positions: [{ key: "main", x: seat[0], y: seat[1], state: "seated" }],
      selectedKey: null,
      bubbles: new Map([["main", { text, event_index: 1 }]]),
      cellPx: 24,
    });
    const rr = ctx.calls.find((c) => c.op === "roundRect").args;
    const natural = 0.6 * 10 * Array.from(text).length;
    assert.ok(rr[2] <= 139, `width ${rr[2]} for ${text.length} characters`);
    assert.equal(rr[2], Math.min(natural, 125) + 14);
    const t = ctx.calls.find(
      (c) =>
        c.op === "fillText" &&
        c.args[0] === text &&
        c.font === "10px system-ui",
    );
    assert.equal(t.args[3], natural > 125 ? 125 : undefined);
  }
});

test("OF-36: the legend fits the panel on the first load - the canvas is fitted AFTER the legend is drawn (critical QA finding)", async () => {
  const j = journal();
  j.sessionStart("S1");
  launch(j, "S1", "a1", "Explore");
  launch(j, "S1", "a2", "Plan");
  const page = makePage({ entries: [...j.entries] });
  // measurements of a stand: the panel is 1472 x 760; every legend entry is 30 px high
  const inner = page.el("office-inner");
  inner.clientWidth = 1472;
  inner.clientHeight = 760;
  Object.defineProperty(page.el("legend"), "offsetHeight", {
    get() {
      return this.children.length * 30;
    },
  });
  await page.start();
  assert.equal(page.legend().length, 3);
  const legendHeight = 3 * 30;
  const expected = Math.max(
    27,
    Math.floor(Math.min(1472 / 35, (760 - legendHeight) / 22)),
  );
  assert.equal(expected, 30);
  // without the legend the cell would be 34: 748 + 90 > 760
  assert.equal(Math.floor(Math.min(1472 / 35, 760 / 22)), 34);
  assert.equal(
    page.canvas.width,
    35 * expected,
    "the canvas leaves room for the legend",
  );
  assert.equal(page.canvas.height, 22 * expected);
  assert.deepEqual([page.canvas.width, page.canvas.height], [1050, 660]);
  assert.ok(
    page.canvas.height + legendHeight <= 760,
    "the legend is not cut off",
  );
  // and after a rebuild with one more role
  launch(j, "S1", "a3", "Sai Orchestrator (ORCH)");
  await page.push(...j.entries.slice(-2));
  const again = Math.max(
    27,
    Math.floor(Math.min(1472 / 35, (760 - 4 * 30) / 22)),
  );
  assert.equal(again, 29);
  assert.equal(page.canvas.width, 35 * again);
});

test("OF-37: after the legend and the card are rebuilt the keyboard focus returns to the button of the same character, and '×' keeps the focus", async () => {
  const j = journal();
  j.sessionStart("S1");
  launch(j, "S1", "a1", "Explore");
  const page = makePage({ entries: [...j.entries] });
  await page.start();
  const button = () =>
    page.legend().find((b) => b.dataset.key === "role:Explore");
  const old = button();
  old.focus();
  assert.ok(
    page.doc.activeElement === old,
    "focus is not on the expected element",
  );
  launch(j, "S1", "a2", "Plan");
  await page.push(...j.entries.slice(-2));
  const fresh = button();
  assert.ok(fresh !== old, "the legend was rebuilt");
  assert.ok(
    page.doc.activeElement === fresh,
    "the focus went to the new button of the same character",
  );
  // the card: the focus on the cross stays on the new cross
  fresh.click();
  const cross = () => page.el("card").byClass("card-close")[0];
  assert.ok(
    page.doc.activeElement === cross(),
    "focus is not on the expected element",
  );
  const oldCross = cross();
  j.subStop("S1", "a2", "Plan");
  await page.push(j.entries[j.entries.length - 1]);
  assert.ok(cross() !== oldCross, "the card was rebuilt");
  assert.ok(
    page.doc.activeElement === cross(),
    "focus is not on the expected element",
  );
});

// ----------------------------------------------------------------- OF-38

async function fittedPage(setup, { frames = false } = {}) {
  const j = journal();
  j.sessionStart("S1");
  launch(j, "S1", "a1", "Explore");
  const page = makePage({ entries: [...j.entries] });
  setup(page);
  await page.start();
  if (frames) page.frames.step(16);
  return page;
}
const cellOf = (page) => [
  page.canvas.width / 35,
  page.canvas.width,
  page.canvas.height,
];

test("OF-38: the canvas is fitted at a scale above 1 - rectangles first, whole numbers as the way out, the two modes are not mixed; the result depends only on the measures", async () => {
  const cases = [
    [{ width: 1472, height: 966, legend: 39, gap: 10 }, [41, 1435, 902]],
    [
      { width: 1963.33, height: 1288.67, legend: 52, gap: 13.33 },
      [55, 1925, 1210],
    ],
    [{ width: 3169, height: 1990, legend: 58.5, gap: 15 }, [87, 3045, 1914]],
    [{ width: 3169, height: 1990, legend: 91.5, gap: 15 }, [85, 2975, 1870]],
    [
      { width: 1963.33, height: 1448.67, legend: 52, gap: 13.33 },
      [56, 1960, 1232],
    ],
  ];
  for (const [m, want] of cases) {
    const page = await fittedPage((p) => setPanelRects(p, m));
    assert.deepEqual(cellOf(page), want, JSON.stringify(m));
    assert.ok(page.canvas.height + m.legend + m.gap <= m.height + 1e-6);
  }
  // the same numbers as whole numbers give the same cell
  const ints = await fittedPage((p) =>
    setPanelInts(p, { width: 1963, height: 1289, legend: 52, gap: 13 }),
  );
  assert.deepEqual(cellOf(ints), [55, 1925, 1210]);
  // a stand below the lower bound: the cell stays 27 and the canvas does not
  // fit its area (it scrolls inside #office-scroll, OF-40)
  const below = await fittedPage((p) =>
    setPanelRects(p, { width: 1472, height: 600, legend: 90, gap: 10 }),
  );
  assert.equal(Math.floor(Math.min(1472 / 35, 500 / 22)), 22);
  assert.deepEqual(cellOf(below), [27, 945, 594]);
  // an empty rectangle of the area: the whole numbers are read, even where the
  // legend has a good rectangle
  const mixed = await fittedPage((p) => {
    const m = { width: 1472, height: 600, legend: 90, gap: 10 };
    setPanelInts(p, m);
    setPanelRects(p, { width: 3169, height: 1990, legend: 1, gap: 1 });
    p.el("office-inner").rect = {
      left: 0,
      top: 0,
      width: 0,
      height: 0,
      bottom: 0,
    };
  });
  assert.equal(
    mixed.canvas.width / 35,
    Math.max(27, Math.floor(Math.min(1472 / 35, 500 / 22))),
  );
  // a rectangle of the area but none of the legend: all four measures are
  // whole numbers, the modes are not mixed
  const half = await fittedPage((p) => {
    setPanelInts(p, { width: 1472, height: 600, legend: 90, gap: 10 });
    p.el("office-inner").rect = {
      left: 0,
      top: 0,
      width: 3169,
      height: 1990,
      bottom: 1990,
    };
  });
  assert.equal(half.canvas.width / 35, 27);
  // a rectangle of the area: no whole number is looked at
  const rects = await fittedPage((p) => {
    setPanelInts(p, { width: 400, height: 300, legend: 10, gap: 0 });
    setPanelRects(p, {
      width: 1963.33,
      height: 1288.67,
      legend: 52,
      gap: 13.33,
    });
  });
  assert.deepEqual(cellOf(rects), [55, 1925, 1210]);
  // the root size is not read: the stand's documentElement throws
  const page = await fittedPage((p) => {
    Object.defineProperty(p.doc, "documentElement", {
      get() {
        throw new Error("documentElement is read");
      },
    });
    setPanelRects(p, { width: 3169, height: 1990, legend: 58.5, gap: 15 });
  });
  assert.deepEqual(cellOf(page), [87, 3045, 1914]);
});

test("OF-38: resize - a new window gives new attributes and exactly one new frame; the same measures change nothing", async () => {
  const page = await fittedPage((p) =>
    setPanelRects(p, { width: 1472, height: 966, legend: 39, gap: 10 }),
  );
  assert.deepEqual(cellOf(page), [41, 1435, 902]);
  assert.ok(page.resizeListeners.length >= 1);
  const frames = () => page.ctx.frames().length;
  const before = frames();
  for (const fn of page.resizeListeners) fn();
  assert.deepEqual(cellOf(page), [41, 1435, 902]);
  assert.equal(frames(), before, "the same measures: no new frame");
  setPanelRects(page, {
    width: 1963.33,
    height: 1288.67,
    legend: 52,
    gap: 13.33,
  });
  for (const fn of page.resizeListeners) fn();
  assert.deepEqual(cellOf(page), [55, 1925, 1210]);
  assert.equal(frames(), before + 1, "one new frame");
  for (const fn of page.resizeListeners) fn();
  assert.equal(frames(), before + 1, "and no more");
});

test("OF-38: the canvas fonts do not depend on the cell - the same font strings at 27 and 54, setTransform scale is cellPx / 24", () => {
  const j = journal();
  j.sessionStart("S1");
  launch(j, "S1", "a1", "Explore");
  const { o } = mk(j.entries);
  const seat = o.layout.desks[0].seat;
  const run = (cellPx) => {
    const ctx = makeCtx();
    drawOffice(ctx, o, {
      positions: [{ key: "main", x: seat[0], y: seat[1], state: "seated" }],
      selectedKey: null,
      bubbles: new Map([["main", { text: BUBBLE_TEXTS.done, event_index: 1 }]]),
      cellPx,
    });
    return ctx;
  };
  const a = run(27);
  const b = run(54);
  const fonts = (ctx) => [...new Set(ctx.calls.map((c) => c.font))].sort();
  assert.deepEqual(fonts(a), fonts(b));
  const allowed = new Set([
    "9px system-ui",
    "bold 8px system-ui",
    "bold 7px system-ui",
    "10px system-ui",
  ]);
  for (const ctx of [a, b]) {
    const texts = ctx.calls.filter((c) => c.op === "fillText");
    assert.ok(texts.length > 0);
    for (const c of texts) {
      assert.ok(allowed.has(c.font), `a canvas font ${c.font}`);
    }
  }
  assert.equal(a.calls.find((c) => c.op === "setTransform").args[0], 27 / 24);
  assert.equal(b.calls.find((c) => c.op === "setTransform").args[0], 54 / 24);
});

test("OF-38: a failure - a NaN gap, a zero area or a missing rectangle gives the cell 27; the journal and the canvas stay as they were", async () => {
  const bad = [
    { width: 1963.33, height: 1288.67, legend: 52, gap: NaN },
    { width: 0, height: 0, legend: 52, gap: 10 },
  ];
  for (const m of bad) {
    const page = await fittedPage((p) => setPanelRects(p, m));
    const sizeBefore = [page.canvas.width, page.canvas.height];
    const entries = JSON.stringify(page.server.entries);
    const rows = page.rows().length;
    for (const fn of page.resizeListeners) fn();
    assert.deepEqual(sizeBefore, [945, 594], JSON.stringify(m));
    assert.deepEqual([page.canvas.width, page.canvas.height], sizeBefore);
    assert.equal(JSON.stringify(page.server.entries), entries);
    assert.equal(page.rows().length, rows);
    assert.equal(page.app.getOffice().characters.length, 2);
  }
});

// ------------------------------------------------ design 4.15, 10: OF-39...OF-42

// The frame of every character seated at its place.
function seatedFrame(o, cellPx) {
  return {
    positions: o.characters.map((c) => ({
      key: c.key,
      x: o.layout.desks[c.desk_index].seat[0],
      y: o.layout.desks[c.desk_index].seat[1],
      state: "seated",
    })),
    selectedKey: null,
    bubbles: new Map(),
    cellPx,
  };
}

const fontPx = (font) => Number(/(\d+(?:\.\d+)?)px/.exec(font)[1]);

test("OF-39: 19 desks at the smallest cell - the figure is at least 20 px and the caption at least 10 px on the screen; 19 laptops, 19 chairs of the desks, 19 characters (data-drawn) and the three captions of the rooms", async () => {
  assert.equal(MIN_CELL_PX, 27);
  assert.equal(LEGEND_ROLES.length, 18);
  const j = legendJournal();
  const { o } = mk(j.entries);
  assert.equal(o.characters.length, 19);
  assert.equal(o.layout.desks.length, 19);
  // the role i of the list stands at the desk i + 1 (the main session at 0)
  LEGEND_ROLES.forEach((role, i) => {
    assert.equal(charOf(o, `role:${role}`).desk_index, i + 1, role);
  });
  const ctx = makeCtx();
  const count = drawOffice(ctx, o, seatedFrame(o, MIN_CELL_PX));
  assert.equal(count, 19);
  const calls = ctx.lastFrame();
  const k = calls[0].args[0];
  assert.equal(calls[0].op, "setTransform");
  assert.equal(k, MIN_CELL_PX / 24);
  const rects = calls.filter((c) => c.op === "fillRect").map((c) => c.args);
  const has = (...want) =>
    rects.filter((r) => r.every((v, i) => v === want[i])).length;
  for (const c of o.characters) {
    const spot = o.layout.desks[c.desk_index];
    const [sx, sy] = [spot.seat[0] * 24, spot.seat[1] * 24];
    const [bx, by] = [spot.block[0] * 24, spot.block[1] * 24];
    // the figure: from the top of the hair to the bottom of the body
    const hair = rects.filter(
      (r) => r[0] === sx + 8 && r[1] === sy + 2 && r[2] === 8 && r[3] === 3,
    );
    const body = rects.filter(
      (r) => r[0] === sx + 6 && r[1] === sy + 9 && r[2] === 12 && r[3] === 11,
    );
    assert.equal(hair.length, 1, c.key);
    assert.equal(body.length, 1, c.key);
    const height = body[0][1] + body[0][3] - hair[0][1];
    assert.ok(height * k >= 20, `${c.key}: the figure is ${height * k} px`);
    // one laptop screen, one base and one chair at every desk
    assert.equal(has(bx + 23, by + 5, 16, 11), 1, `${c.key}: screen`);
    assert.equal(has(bx + 21, by + 16, 20, 3), 1, `${c.key}: base`);
    assert.equal(has(sx + 4, sy + 6, 16, 18), 1, `${c.key}: chair`);
    // the caption: the size of its font on the screen
    // REQ-048: the caption at the desk, in the font of the captions; its
    // first line is the beginning of the name (a long name has two lines)
    const caption = calls.find(
      (x) =>
        x.op === "fillText" &&
        x.font === LABEL_FONT &&
        typeof x.args[0] === "string" &&
        x.args[0] !== "" &&
        c.label.startsWith(x.args[0]) &&
        x.args[1] === sx + 12 &&
        x.args[2] === sy + 31,
    );
    assert.ok(caption !== undefined, `${c.key}: caption`);
    assert.ok(
      fontPx(caption.font) * k >= 10,
      `${c.key}: the font ${caption.font}`,
    );
  }
  // the captions of the rooms
  for (const [name, x, y] of [
    ["meeting", 580, 21],
    ["server", 624, 309],
    ["kitchen", 842, 261],
  ]) {
    const hits = calls.filter(
      (c) =>
        c.op === "fillText" &&
        c.args[0] === ROOM_LABELS[name] &&
        c.args[1] === x &&
        c.args[2] === y,
    );
    assert.equal(hits.length, 1, name);
  }
  // the page draws 19 characters on its own
  const page = makePage({ entries: [...j.entries] });
  await page.start();
  assert.equal(page.canvas.hasAttribute("data-drawn"), false);
  page.frames.step();
  assert.equal(page.canvas.dataset.drawn, "19");
  assert.equal(page.canvas.width, 35 * MIN_CELL_PX);
  assert.equal(page.canvas.height, 22 * MIN_CELL_PX);
});

const STYLE_CSS = fs.readFileSync(path.join(PUBLIC, "style.css"), "utf8");
const WIDE = "@media (min-width: 1240px) and (min-height: 640px)";
const NARROW = "@media (max-width: 599px)";

test("OF-40: 40 desks in a stand of 1022 x 670 - the cell stays 27 and the canvas (1404 x 594) is wider than its area, so it scrolls inside #office-scroll; the click on the shifted rectangle of the canvas hits the right character", async () => {
  const j = rolesJournal(39);
  const page = makePage({ entries: [...j.entries] });
  setPanelRects(page, { width: 1022, height: 670, legend: 39, gap: 10 });
  await page.start();
  const o = page.app.getOffice();
  assert.equal(o.characters.length, 40);
  assert.equal(o.layout.width, 52);
  assert.equal(o.layout.height, 22);
  assert.equal(page.canvas.width, 1404);
  assert.equal(page.canvas.height, 594);
  assert.ok(1404 > 1022);
  // the canvas is the child of #office-scroll
  const scroll = page.el("office-scroll");
  assert.ok(scroll.children.length === 1 && scroll.children[0] === page.canvas);
  assert.equal(page.canvas.hasAttribute("style"), false);
  assert.equal(scroll.hasAttribute("style"), false);
  assert.equal(page.el("office-inner").hasAttribute("style"), false);
  // the sheet: the wrapper scrolls, the area does not
  const rules = parseCss(STYLE_CSS);
  const wrap = cssDecls(rules, ".office-scroll");
  assert.equal(wrap.get("overflow"), "auto");
  assert.equal(wrap.get("max-width"), "100%");
  assert.equal(wrap.get("min-height"), "0");
  assert.equal(cssDecls(rules, ".office-inner").get("overflow"), "hidden");
  for (const media of [WIDE, NARROW])
    assert.equal(
      cssDecls(rules, ".office-scroll", media).has("overflow"),
      false,
    );
  // a click in the scrolled canvas: its rectangle is shifted by the scroll
  for (const [desk, shift] of [
    [2, 250],
    [39, 0],
    [21, 400],
  ]) {
    const character = o.characters.find((c) => c.desk_index === desk);
    assert.ok(character !== undefined, `desk ${desk}`);
    const seat = o.layout.desks[desk].seat;
    page.canvas.rect = { left: -shift, top: 0, width: 1404, height: 594 };
    page.canvas.click({
      clientX: -shift + (seat[0] - o.layout.min_x) * 27 + 13.5,
      clientY: seat[1] * 27 + 13.5,
    });
    assert.equal(page.el("card-overlay").hidden, false, `desk ${desk}`);
    // REQ-044, REQ-048: the title is the name in plain words; the code is
    // only a line in the details of the head, when it differs
    const name = roleName(character.full);
    assert.equal(
      page.el("card").byClass("card-title")[0].textContent,
      name,
      `desk ${desk}`,
    );
    assert.equal(page.el("card").byClass("card-code").length, 0);
    const code = page.el("card").byClass("code-row");
    if (name === character.full) assert.equal(code.length, 0);
    else {
      assert.deepEqual(
        code.map((e) => e.textContent),
        [`код роли: ${character.full}`],
        `desk ${desk}`,
      );
    }
    page.el("card-overlay").hidden = true;
  }
});

test("OF-41: the legend is a strip of two lines - the rule .legend with max-height 2.4375rem and overflow-y auto stands only inside the wide @media; the canvas is fitted after the legend (cell 28, 980 x 616); all 19 legend items are in #legend and none is hidden", async () => {
  const rules = parseCss(STYLE_CSS);
  const wide = cssDecls(rules, ".legend", WIDE);
  assert.equal(wide.get("max-height"), "2.4375rem");
  assert.equal(wide.get("overflow-y"), "auto");
  assert.equal(cssDecls(rules, ".legend", null).has("max-height"), false);
  assert.equal(cssDecls(rules, ".legend", NARROW).has("max-height"), false);
  assert.equal(
    rules.filter((r) => r.media !== null && r.media.includes("1240px")).length >
      0,
    true,
  );
  const j = legendJournal();
  const page = makePage({ entries: [...j.entries] });
  setPanelRects(page, { width: 1022, height: 670, legend: 39, gap: 10 });
  await page.start();
  assert.equal(page.canvas.width, 980);
  assert.equal(page.canvas.height, 616);
  const o = page.app.getOffice();
  const items = page.legend();
  assert.equal(items.length, 19);
  assert.deepEqual(
    items.map((b) => b.dataset.key).sort(),
    o.characters.map((c) => c.key).sort(),
  );
  for (const b of items) {
    assert.equal(b.hidden, false, b.dataset.key);
    assert.equal(b.hasAttribute("hidden"), false, b.dataset.key);
    assert.ok(page.el("legend").all((e) => e === b).length === 1);
  }
  // without the legend the same stand would give a bigger cell: the band counts
  const free = makePage({ entries: [...j.entries] });
  setPanelRects(free, { width: 1022, height: 670, legend: 1, gap: 0 });
  await free.start();
  assert.equal(free.canvas.width, 35 * 29);
});

test("OF-42: the plate under a caption - labelPlate by the numbers of the design (the edges 72 / 72.5 and 94 / 95, an undrawn line, the passage row, the lower wall, the extra column); in a frame of 19 desks the plates are under the captions that touch a line, a caption of two lines has a plate of two lines", () => {
  const l19 = buildLayout(19);
  const place = (layout, d) => layout.desks[d].seat.map((v) => v * 24);
  assert.deepEqual(place(l19, 2), [504, 48]);
  assert.deepEqual(place(l19, 0), [216, 48]);
  assert.deepEqual(place(l19, 8), [504, 192]);
  assert.deepEqual(place(l19, 18), [216, 480]);
  const at = (layout, d, w) => labelPlate(layout, ...place(layout, d), w);
  // the wall x = 23 touches a caption wider than 72 px in column 2
  assert.equal(at(l19, 2, 72), null);
  assert.deepEqual(at(l19, 2, 72.5), { x: 477.75, y: 71, w: 76.5, h: 11 });
  assert.notEqual(at(l19, 2, 130), null);
  // the line x = 11 touches a caption wider than 94 px in column 0
  assert.equal(at(l19, 0, 94), null);
  assert.notEqual(at(l19, 0, 95), null);
  // the same place with one desk: the line is not drawn, so no plate
  assert.deepEqual(buildLayout(1).partitions, []);
  assert.equal(at(buildLayout(1), 0, 130), null);
  // the passage row 9: nothing is touched
  assert.equal(at(l19, 8, 130), null);
  // the lower wall: any caption of the lowest row
  assert.notEqual(at(l19, 18, 1), null);
  // an extra column: the line x = 5
  const l22 = buildLayout(22);
  assert.deepEqual(place(l22, 21), [72, 48]);
  assert.equal(at(l22, 21, 94), null);
  assert.notEqual(at(l22, 21, 95), null);
  // a width that is not a width
  for (const w of [0, -1, Number.NaN]) assert.equal(at(l19, 2, w), null);

  // the frame
  const { o } = mk(legendJournal().entries);
  const ctx = makeCtx();
  drawOffice(ctx, o, seatedFrame(o, MIN_CELL_PX));
  const calls = ctx.lastFrame();
  const plates = calls
    .map((c, i) => [c, i])
    .filter(([c]) => c.op === "fillRect" && c.fillStyle === LABEL_PLATE_COLOR);
  // REQ-048: every caption is the name of the role at its desk, in one or two
  // lines of the font of the captions
  const lines = calls
    .map((c, i) => [c, i])
    .filter(([c]) => c.op === "fillText" && c.font === LABEL_FONT);
  const firstLine = lines[0][1];
  for (const [, i] of plates)
    assert.ok(i > firstLine - 1, "a plate is drawn with the captions");
  const plated = [];
  let total = 0;
  for (const c of o.characters) {
    const spot = o.layout.desks[c.desk_index];
    const cx = spot.seat[0] * 24 + 12;
    const b = spot.seat[1] * 24 + 31;
    const mine = lines.filter(
      ([x]) =>
        x.args[1] === cx &&
        (x.args[2] === b || x.args[2] === b + 10) &&
        x.textAlign === "center",
    );
    assert.ok(mine.length === 1 || mine.length === 2, `${c.key}: caption`);
    assert.equal(mine[0][0].args[2], b, `${c.key}: the first line`);
    total += mine.length;
    const text = mine.map(([x]) => x.args[0]);
    const joined =
      text.length === 1
        ? text[0]
        : text[0].endsWith("-")
          ? text[0] + text[1]
          : `${text[0]} ${text[1]}`;
    assert.equal(joined, c.label, `${c.key}: the lines make the name`);
    const before = calls[mine[0][1] - 1];
    const isPlate =
      before.op === "fillRect" && before.fillStyle === LABEL_PLATE_COLOR;
    if (!isPlate) continue;
    plated.push(c.desk_index);
    const w = Math.min(
      Math.max(...text.map((t) => 5.4 * Array.from(t).length)),
      130,
    );
    const want = [cx - w / 2 - 2, b - 8, w + 4, 11 + 10 * (text.length - 1)];
    want.forEach((v, n) =>
      assert.ok(
        Math.abs(before.args[n] - v) < 1e-9,
        `${c.key}: plate ${before.args}`,
      ),
    );
  }
  assert.equal(total, 20, "one caption of the 19 is two lines");
  assert.deepEqual(plated, [4, 5, 7, 9, 11, 12, 14, 15, 16, 18]);
  assert.equal(plates.length, plated.length);
  // the names of the captions, as the design names them
  assert.equal(
    charOf(o, `role:${LEGEND_ROLES[4]}`).label,
    "Описание интерфейса",
  );
  assert.equal(charOf(o, `role:${LEGEND_ROLES[10]}`).label, "Проверка тестов");
  assert.equal(charOf(o, `role:${LEGEND_ROLES[17]}`).label, "Серверная часть");
  assert.equal(charOf(o, `role:${LEGEND_ROLES[13]}`).label, "Исправление кода");
  assert.equal(
    charOf(o, `role:${LEGEND_ROLES[7]}`).label,
    "Страницы и интерфейс",
  );
  assert.equal(charOf(o, "main").label, "Основная сессия");
});

// ===================================================================
// REQ-042: state honesty (design 10: FS-07, FS-13, FS-19). "Now" is a number
// given by the test; the real clock is never read.
// ===================================================================
import { lineAt, startRec } from "./pixel-office-helpers.js";

const LAST = T0 + 1500;
// One sequence: a session, a request of the main session, a launch of Explore.
function sequence(extra = []) {
  return [
    lineAt("SessionStart", "S1", T0),
    lineAt("UserPromptSubmit", "S1", T0 + 500),
    lineAt("PostToolUse", "S1", T0 + 900, {
      tool_use_id: "tu1",
      launched_agent_id: "a1",
      subagent_type: "Explore",
      description: "check",
    }),
    lineAt("SubagentStart", "S1", T0 + 1000, {
      agent_id: "a1",
      agent_type: "Explore",
    }),
    lineAt("PostToolUse", "S1", LAST, {
      tool_use_id: "tu2",
      launched_agent_id: "nobody",
    }),
    ...extra,
  ];
}

function viewOf(entries, starts, now) {
  const m = buildModel(entries, starts, now);
  const o = buildOffice(m);
  const ctx = frameOf(o);
  const explore = charOf(o, "role:Explore");
  return {
    m,
    o,
    main: charOf(o, "main").working,
    explore: explore.working,
    screenMain: screenColor(ctx, o, 0),
    screenExplore: screenColor(ctx, o, explore.desk_index),
    running: charOf(o, "main").sessions_running,
    columns: o.board.columns.map((c) => c.key),
    bubbles: bubblesAt(o, now).size,
  };
}

test("FS-07: 'нет свежих данных', 'сервер перезапускался…' and 'окончание не записано' do not show work - one sequence at two moments: the character works, the screen lights, a session runs, the board has a column - then the character is free, the screen is dark, no session runs, no column; the routes and bubbles are the same", () => {
  const entries = sequence();
  const before = viewOf(entries, [], LAST + STALE_AFTER_MS);
  assert.equal(before.main, true);
  assert.equal(before.explore, true);
  assert.equal(before.screenMain, PALETTE[0]);
  assert.equal(before.screenExplore, PALETTE[1]);
  assert.equal(before.running, 1);
  assert.deepEqual(before.columns, ["role:Explore"]);

  const after = viewOf(entries, [], LAST + STALE_AFTER_MS + 1);
  assert.equal(after.main, false);
  assert.equal(after.explore, false);
  assert.equal(after.screenMain, "#111d2e");
  assert.equal(after.screenExplore, "#111d2e");
  assert.equal(after.running, 0);
  assert.deepEqual(after.columns, []);
  assert.equal(
    after.bubbles,
    0,
    "the move into 'нет свежих данных' is no bubble",
  );
  assert.equal(charOf(after.o, "role:Explore").working_count, 0);
  // not a route and not a bubble more: the office differs only by the states
  assert.deepEqual(after.o.routes, before.o.routes);
  assert.deepEqual(after.o.bubble_events, before.o.bubble_events);
  // criterion 2(g): no line of the journal is born from the move either
  assert.equal(before.m.journal.length, entries.length);
  assert.deepEqual(after.m.journal, before.m.journal);
  assert.equal(after.o.routes.length, 1, "the handoff of the launch only");

  // the word about the restart
  const restarted = viewOf(
    entries,
    [startRec(entries.length, T0 + 2000)],
    LAST + 1000,
  );
  assert.equal(restarted.main, false);
  assert.equal(restarted.explore, false);
  assert.equal(restarted.screenMain, "#111d2e");
  assert.equal(restarted.screenExplore, "#111d2e");
  assert.equal(restarted.running, 0, "the last event is before the start");
  assert.deepEqual(restarted.columns, []);
  assert.deepEqual(restarted.o.routes, before.o.routes);

  // 'окончание не записано'
  const ended = viewOf(
    sequence([lineAt("SessionEnd", "S1", T0 + 2000)]),
    [],
    T0 + 3000,
  );
  assert.equal(ended.main, false);
  assert.equal(ended.explore, false);
  assert.equal(ended.screenExplore, "#111d2e");
  assert.equal(ended.running, 0);
  assert.deepEqual(ended.columns, []);
});

test("FS-07: on the page - the legend says 'работает' before the border and 'свободен' / 'свободна' after the planned recalculation, no walker is added, the sim has the same routes", async () => {
  const entries = sequence();
  const page = makePage({
    entries: [...entries],
    now: LAST + STALE_AFTER_MS - 4000,
  });
  await page.start();
  const legend = () =>
    Object.fromEntries(
      page
        .legend()
        .map((b) => [b.dataset.key, b.byClass("state")[0].textContent]),
    );
  assert.deepEqual(legend(), { main: "работает", "role:Explore": "работает" });
  const routes = page.app.getOffice().routes.length;
  const queued = () =>
    page.app
      .getSim()
      .positions()
      .reduce((n, p) => n + p.queued, 0);
  const walking = queued();
  // 10 s of the page clock, no new line: the planned recalculation
  await page.tick(10_000);
  assert.deepEqual(legend(), { main: "свободна", "role:Explore": "свободен" });
  assert.equal(page.server.entries.length, entries.length);
  assert.equal(page.app.getOffice().routes.length, routes);
  assert.equal(queued(), walking, "nobody was sent walking");
  assert.equal(bubblesAt(page.app.getOffice(), page.clock.now()).size, 0);
  assert.equal(page.app.getOffice().board.columns.length, 0);
  // the screen of the desk by the drawing calls
  page.frames.step();
  const o = page.app.getOffice();
  const ctx = page.ctx;
  assert.equal(
    screenColor(ctx, o, charOf(o, "role:Explore").desk_index),
    "#111d2e",
  );
});

// ------------------------------------------------------------------ FS-13

const SUCCESS = /заверш|готов|выполнен|успешн/i;

test("FS-13: the code of the page has no words of success - заверш|готов|выполнен|успешн in public/ find only the caption of the time of the last Stop (HISTORY_META_FINISHED); the bubbles are 'Закончил работу' and 'Вернул ответ' and no other phrase", () => {
  const hits = [];
  for (const name of fs.readdirSync(PUBLIC).sort()) {
    const file = path.join(PUBLIC, name);
    if (!fs.statSync(file).isFile()) continue;
    fs.readFileSync(file, "utf8")
      .split("\n")
      .forEach((text, i) => {
        if (SUCCESS.test(text) && !text.includes("HISTORY_META_FINISHED")) {
          hits.push(`${name}:${i + 1}: ${text.trim()}`);
        }
      });
  }
  assert.deepEqual(hits, []);
  // the exception is real and named: the caption is a time label, not a state
  const texts = fs.readFileSync(path.join(PUBLIC, "texts.js"), "utf8");
  assert.ok(/HISTORY_META_FINISHED\s*=\s*"завершён"/.test(texts));
  // the expression: it sees the words, and a line with the name of the caption passes
  assert.equal(SUCCESS.test("done: Готово"), true);
  assert.equal(SUCCESS.test("Недавно завершены"), true);
  assert.equal(SUCCESS.test("const x = HISTORY_META_FINISHED;"), false);
  // the phrases of the bubbles, as literals
  assert.equal(BUBBLE_TEXTS.done, "Закончил работу");
  assert.equal(BUBBLE_TEXTS.answer_ready, "Вернул ответ");
  const phrases = Object.values(BUBBLE_TEXTS).sort();
  assert.deepEqual(
    phrases,
    [
      "Вернул ответ",
      "Закончил работу",
      "Получил запрос",
      "Только что получил задачу",
    ].sort(),
  );
  for (const p of phrases) assert.doesNotMatch(p, SUCCESS);
});

// ------------------------------------------------------------------ FS-19

const FIVE = {
  in_progress: 0,
  stale: 0,
  restarted: 0,
  completed: 0,
  unrecorded: 0,
};

test("FS-19: the report command takes the clock as a parameter - five counters per role, 'нет свежих данных' and 'сервер перезапускался…' do not make a role work, the output does not depend on today's date; the journal is not changed", (t) => {
  const box = sandbox(t);
  const entries = [
    // Explore: one running, one silent (old session), one restarted
    lineAt("SessionStart", "R", T0),
    lineAt("SubagentStart", "R", T0 + 100, {
      agent_id: "boot",
      agent_type: "Explore",
    }),
    // the server restarts here (journal_lines 2)
    lineAt("SessionStart", "O", T0 + 1000),
    lineAt("SubagentStart", "O", T0 + 1100, {
      agent_id: "old",
      agent_type: "Explore",
    }),
    lineAt("SessionStart", "F", T0 + 2 * 3600 * 1000),
    lineAt("SubagentStart", "F", T0 + 2 * 3600 * 1000 + 100, {
      agent_id: "fresh",
      agent_type: "Explore",
    }),
    // Plan: finished, and one that ended with the session
    lineAt("SubagentStart", "F", T0 + 2 * 3600 * 1000 + 200, {
      agent_id: "done",
      agent_type: "Plan",
    }),
    lineAt("SubagentStop", "F", T0 + 2 * 3600 * 1000 + 300, {
      agent_id: "done",
      agent_type: "Plan",
    }),
    lineAt("SubagentStart", "E", T0 + 2 * 3600 * 1000 + 400, {
      agent_id: "ended",
      agent_type: "Plan",
    }),
    lineAt("SessionEnd", "E", T0 + 2 * 3600 * 1000 + 500),
  ];
  const file = writeJournal(box, entries, [startRec(2, T0 + 500)]);
  const hash = sha256File(file);
  const nowMs = T0 + 2 * 3600 * 1000 + 1000;
  const run = (clock, argv = ["--journal", file]) => {
    const io = reportIo();
    assert.equal(runReport(argv, io, clock), 0, io.err);
    return JSON.parse(io.out);
  };
  const rep = run(() => nowMs);
  const explore = rep.roles.find((r) => r.role === "Explore");
  const plan = rep.roles.find((r) => r.role === "Plan");
  assert.deepEqual(explore.counts, {
    ...FIVE,
    in_progress: 1,
    stale: 1,
    restarted: 1,
  });
  assert.equal(explore.working, true);
  assert.equal(explore.working_count, 1, "only the one 'в работе'");
  assert.deepEqual(plan.counts, { ...FIVE, completed: 1, unrecorded: 1 });
  assert.equal(plan.working, false);
  for (const r of rep.roles) {
    for (const key of Object.keys(FIVE)) {
      assert.ok(Number.isInteger(r.counts[key]), `${r.role}.${key}`);
    }
    assert.deepEqual(Object.keys(r.counts).sort(), Object.keys(FIVE).sort());
  }
  // later by an hour: the fresh one is silent too - the role stops working
  const later = run(() => nowMs + 2 * 3600 * 1000);
  const exploreLater = later.roles.find((r) => r.role === "Explore");
  assert.deepEqual(exploreLater.counts, {
    ...FIVE,
    stale: 2,
    restarted: 1,
  });
  assert.equal(exploreLater.working, false);
  assert.equal(exploreLater.working_count, 0);
  assert.equal(later.main.working, false);
  // the same clock - the same report, today's date is not read
  assert.deepEqual(
    run(() => nowMs),
    rep,
  );
  // with --session the counters follow that session only
  const one = run(() => nowMs, ["--journal", file, "--session", "O"]);
  assert.deepEqual(one.roles[0].counts, { ...FIVE, stale: 1 });
  assert.equal(one.roles[0].working, false);
  // the command only reads
  assert.equal(sha256File(file), hash);
  // a wrong use is refused and the clock is not asked
  let asked = 0;
  assert.equal(
    runReport(["--journal", file, "--journal", file], reportIo(), () => {
      asked += 1;
      return nowMs;
    }),
    2,
  );
  assert.equal(asked, 0);
  assert.equal(sha256File(file), hash);
});

test("FS-07: the board of the meeting room has four plaques in two rows of two - 'в работе', 'закончила работу', 'окончание не записано' and the fourth for 'сервер перезапускался…' - each with its own number", () => {
  const e = [];
  let ms = T0;
  const add = (line) => {
    e.push(line);
    ms += 100;
  };
  const start = (id) =>
    lineAt("SubagentStart", "S", ms, { agent_id: id, agent_type: "Explore" });
  add(lineAt("SessionStart", "S", ms));
  for (let i = 0; i < 4; i++) add(start(`u${i}`)); // will be unrecorded
  add(lineAt("SessionEnd", "S", ms));
  add(lineAt("SessionStart", "S", ms)); // the same session resumes
  for (let i = 0; i < 5; i++) add(start(`r${i}`)); // will be restarted
  const cut = e.length; // the server restarts here
  for (let i = 0; i < 3; i++) {
    add(start(`c${i}`));
    add(
      lineAt("SubagentStop", "S", ms, {
        agent_id: `c${i}`,
        agent_type: "Explore",
      }),
    );
  }
  for (let i = 0; i < 2; i++) add(start(`p${i}`)); // in progress
  add(
    lineAt("PostToolUse", "S", ms, {
      tool_use_id: "tu",
      launched_agent_id: "nobody",
    }),
  );
  const { m, o } = mk(e, [startRec(cut, T0 + 750)], ms + 1000);
  assert.deepEqual(o.board.columns[0].counts, {
    in_progress: 2,
    stale: 0,
    restarted: 5,
    completed: 3,
    unrecorded: 4,
  });
  assert.equal(m.sessions[0].running, true);
  const ctx = frameOf(o);
  const numbers = ctx.calls.filter(
    (c) =>
      c.op === "fillText" &&
      c.font === "bold 8px system-ui" &&
      /^\d+$/.test(String(c.args[0])),
  );
  assert.deepEqual(
    numbers.map((c) => c.args[0]),
    ["2", "3", "4", "5"],
    "in progress, finished, unrecorded, restarted",
  );
  // REQ-048 (design D4): the plaques stand 2 x 2 - two rows of two
  const ys = numbers.map((c) => c.args[2]);
  const xs = numbers.map((c) => c.args[1]);
  assert.deepEqual(
    ys.map((y) => y - ys[0]),
    [0, 0, 10, 10],
  );
  assert.deepEqual(
    xs.map((x) => x - xs[0]),
    [0, 27, 0, 27],
  );
  // the four plaques sit above the caption of the role, inside the board
  const label = ctx.calls.find(
    (c) => c.op === "fillText" && c.args[0] === "Explore" && c.args[3] === 52,
  );
  assert.ok(
    ys[3] < label.args[2] - 7,
    "the fourth plaque is above the caption",
  );
});

test("FS-07: a new event of the session returns 'работает' - after 'нет свежих данных' the character works, the screen lights, the session runs and the column of the board is back; after 'сервер перезапускался…' PostToolUse changes nothing and a repeated start of the same agent returns the work", () => {
  const entries = sequence();
  const nowStale = LAST + STALE_AFTER_MS + 1;
  const silent = viewOf(entries, [], nowStale);
  assert.equal(silent.explore, false);
  assert.deepEqual(silent.columns, []);
  // a line of the hook of the same session, time "now"
  const back = viewOf(
    [
      ...entries,
      lineAt("PostToolUse", "S1", nowStale, {
        tool_use_id: "tu3",
        launched_agent_id: "nobody",
      }),
    ],
    [],
    nowStale,
  );
  assert.equal(back.main, true);
  assert.equal(back.explore, true);
  assert.equal(back.screenMain, PALETTE[0]);
  assert.equal(back.screenExplore, PALETTE[1]);
  assert.equal(back.running, 1);
  assert.deepEqual(back.columns, ["role:Explore"]);
  assert.equal(charOf(back.o, "role:Explore").working_count, 1);
  // the return is one line of the journal more - and no more
  assert.equal(back.m.journal.length, silent.m.journal.length + 1);

  // the word about the restart: it does not return by itself
  const starts = [startRec(entries.length, T0 + 2000)];
  const restarted = viewOf(entries, starts, LAST + 1000);
  assert.equal(restarted.explore, false);
  const withPost = [
    ...entries,
    lineAt("PostToolUse", "S1", LAST + 2000, {
      tool_use_id: "tu4",
      launched_agent_id: "nobody",
    }),
  ];
  const same = viewOf(withPost, starts, LAST + 3000);
  assert.equal(same.explore, false, "PostToolUse does not revive it");
  assert.equal(same.screenExplore, "#111d2e");
  assert.equal(same.m.tasks[0].state, "restarted");
  // a repeated start of the same agent returns the work
  const again = viewOf(
    [
      ...withPost,
      lineAt("SubagentStart", "S1", LAST + 3000, {
        agent_id: "a1",
        agent_type: "Explore",
      }),
    ],
    starts,
    LAST + 4000,
  );
  assert.equal(again.explore, true);
  assert.equal(again.screenExplore, PALETTE[1]);
  assert.equal(again.running, 1);
  assert.deepEqual(again.columns, ["role:Explore"]);
  assert.equal(again.m.tasks.length, 1, "the same task, not a new one");
});

test("FS-07: on the page - after the planned move into 'нет свежих данных' the journal keeps its rows, and a PostToolUse of the session brings back the legend, the screen and the column of the board", async () => {
  const entries = sequence();
  const page = makePage({
    entries: [...entries],
    now: LAST + STALE_AFTER_MS - 4000,
  });
  await page.start();
  const rows = () => page.rows().map((r) => r.textContent);
  const rowsBefore = rows();
  const metaBefore = page.text("journal-meta");
  await page.tick(10_000);
  assert.equal(
    page.legend().every((b) => b.dataset.state === "idle"),
    true,
  );
  assert.deepEqual(rows(), rowsBefore, "no row of the journal is born");
  assert.equal(page.text("journal-meta"), metaBefore);
  assert.equal(page.app.getModel().journal.length, entries.length);
  // a line of the hook of the same session, at the clock of the page
  page.server.entries.push(
    lineAt("PostToolUse", "S1", page.clock.now(), {
      tool_use_id: "tu5",
      launched_agent_id: "nobody",
    }),
  );
  await page.tick(2000);
  const states = Object.fromEntries(
    page
      .legend()
      .map((b) => [b.dataset.key, b.byClass("state")[0].textContent]),
  );
  assert.deepEqual(states, { main: "работает", "role:Explore": "работает" });
  assert.equal(rows().length, rowsBefore.length + 1, "one row: the real line");
  const o = page.app.getOffice();
  assert.deepEqual(
    o.board.columns.map((c) => c.key),
    ["role:Explore"],
  );
  assert.equal(charOf(o, "main").sessions_running, 1);
  page.frames.step();
  assert.equal(
    screenColor(page.ctx, o, charOf(o, "role:Explore").desk_index),
    PALETTE[1],
  );
  assert.equal(screenColor(page.ctx, o, 0), PALETTE[0]);
});

// ===================================================================
// REQ-044 (design docs/design/REQ-036-044-045-interactive.md, 3.6, AC-01):
// what a press on the office opens.
// ===================================================================
import {
  hitOffice,
  labelWidths,
} from "../src/pixel-office/public/office-view.js";

test("AC-01: what a press opens - every cell of every desk (the 2 x 2 block and the seat) gives the character of that desk; a floor cell and the cell of approach give nothing; a character is older than a desk and its caption, a caption than a desk; the caption is measured with the font of the canvas; the caption stays at the desk, a walking character has none; NaN gives nothing", () => {
  const A = "Sai Security Reviewer (SECURITY-REVIEWER)";
  const B = "Sai Test Design Validator (TEST-DESIGN-VALIDATOR)";
  const j = journal();
  j.sessionStart("S1");
  launch(j, "S1", "a1", A);
  launch(j, "S1", "b1", B);
  launch(j, "S1", "c1", "Plan");
  const { o } = mk(j.entries);
  const C = 24;
  const mid = (cx, cy) => [(cx + 0.5) * C, (cy + 0.5) * C];
  const none = new Map();
  const deskCells = new Map();
  for (const desk of o.desks) {
    const spot = o.layout.desks[desk.index];
    const [bx, by] = spot.block;
    const cells = [
      [bx, by],
      [bx + 1, by],
      [bx, by + 1],
      [bx + 1, by + 1],
      spot.seat,
    ];
    for (const [cx, cy] of cells) {
      deskCells.set(`${cx},${cy}`, desk.key);
      assert.equal(
        hitOffice(o, [], ...mid(cx, cy), none),
        desk.key,
        `${desk.key} ${cx},${cy}`,
      );
    }
  }
  assert.equal(o.desks.length, 4, "the main session and three roles");
  // the cell of approach and a floor cell are no desk
  for (const desk of o.desks) {
    const [ax, ay] = o.layout.desks[desk.index].approach;
    if (deskCells.has(`${ax},${ay}`)) continue;
    assert.equal(
      hitOffice(o, [], ...mid(ax, ay), none),
      null,
      `approach of ${desk.key}`,
    );
  }
  let floor = null;
  for (let y = 0; y < o.layout.height && floor === null; y++) {
    for (let x = o.layout.min_x; x < o.layout.min_x + o.layout.width; x++) {
      if (!deskCells.has(`${x},${y}`) && cellKind(o.layout, x, y) === "floor") {
        floor = [x, y];
        break;
      }
    }
  }
  assert.ok(floor !== null);
  assert.equal(hitOffice(o, [], ...mid(...floor), none), null);
  // the character of A walking: a cell of its desk is still its own
  const keyA = `role:${A}`;
  const keyB = `role:${B}`;
  const spotA = o.layout.desks[o.desks.find((d) => d.key === keyA).index];
  const walking = [{ key: keyA, x: floor[0], y: floor[1], state: "walking" }];
  assert.equal(hitOffice(o, walking, ...mid(...spotA.block), none), keyA);
  // B stands on the cell of approach of A's desk
  const [ax, ay] = spotA.approach;
  const onApproach = [{ key: keyB, x: ax, y: ay, state: "walking" }];
  const [bxA, byA] = spotA.block;
  // a point in B's hit and in a cell of A's desk: the point of a cell of A's
  // desk nearest to the middle of B
  const [cxB, cyB] = mid(ax, ay);
  let both = null;
  for (const [key, owner] of deskCells) {
    if (owner !== keyA) continue;
    const [cx, cy] = key.split(",").map(Number);
    const px = Math.min(Math.max(cxB, cx * C + 0.5), (cx + 1) * C - 0.5);
    const py = Math.min(Math.max(cyB, cy * C + 0.5), (cy + 1) * C - 0.5);
    if (Math.abs(px - cxB) < 0.9 * C && Math.abs(py - cyB) < 1.1 * C) {
      both = [px, py];
      break;
    }
  }
  assert.ok(both !== null, "the cell of approach touches the desk");
  assert.equal(
    hitOffice(o, [], ...both, none),
    keyA,
    "the point is on A's desk",
  );
  assert.equal(hitOffice(o, onApproach, ...both, none), keyB, "B is older");
  // a point of A's desk away from B: A
  assert.equal(
    hitOffice(o, onApproach, (bxA + 0.1) * C, (byA + 0.1) * C, none),
    keyA,
  );
  // the caption of a seated character, measured with the font of the canvas
  const ctx = makeCtx();
  const widths = labelWidths(ctx, o);
  assert.equal(ctx.font, LABEL_FONT);
  const w = widths.get(keyA);
  // REQ-048: the caption is the name in plain words
  assert.equal(w, 0.6 * 9 * Array.from(roleName(A)).length);
  const [sx, sy] = spotA.seat;
  const seated = [{ key: keyA, x: sx, y: sy, state: "seated" }];
  const X = Math.round(sx * C);
  const Y = Math.round(sy * C);
  const right = X + 12 + w / 2 + 2;
  // inside the plate, away from the character (more than 0.9 cell sideways)
  const inside = [right - 0.5, Y + 31];
  assert.ok(Math.abs(inside[0] - (sx + 0.5) * C) >= 0.9 * C);
  assert.equal(hitOffice(o, seated, ...inside, widths), keyA);
  // one pixel beyond the edge of the plate (and off any desk): nothing
  const beyond = [right + 1, Y + 31];
  assert.equal(
    deskCells.has(`${Math.floor(beyond[0] / C)},${Math.floor(beyond[1] / C)}`),
    false,
  );
  assert.equal(hitOffice(o, seated, ...beyond, widths), null);
  // without a measured width the caption is not hit
  assert.equal(hitOffice(o, seated, ...inside, none), null);
  // REQ-048: the caption stays at the desk - A away from it, the caption at
  // its desk is still A's
  const away = [{ key: keyA, x: floor[0], y: floor[1], state: "walking" }];
  assert.equal(hitOffice(o, away, ...inside, widths), keyA);
  assert.equal(
    hitOffice(o, [], ...inside, widths),
    keyA,
    "even with no one there",
  );
  // a walking character carries no caption: B walking over a cell of A's
  // desk, a point where its caption would have been - A's desk
  const over = [{ key: keyB, x: bxA - 1, y: byA - 0.5, state: "walking" }];
  const pt = [bxA * C + 10, byA * C + 20];
  assert.equal(
    hitOffice(o, over, ...pt, none),
    keyA,
    "without widths: A's desk",
  );
  assert.equal(
    hitOffice(o, over, ...pt, widths),
    keyA,
    "a walking character has no caption",
  );
  // a point that is not a number
  assert.equal(hitOffice(o, seated, Number.NaN, 10, widths), null);
  assert.equal(hitOffice(o, seated, 10, undefined, widths), null);
  // a measure that throws: the caption is not hit, the desk still is
  const broken = makeCtx();
  broken.measureText = () => {
    throw new Error("no fonts");
  };
  assert.deepEqual([...labelWidths(broken, o).keys()], []);
  assert.equal(
    hitOffice(o, [], ...mid(...spotA.block), labelWidths(broken, o)),
    keyA,
  );
});

// ===================================================================
// REQ-048 (design docs/design/REQ-048-049-046-047-interactive.md, 7.1): one
// name of a role on the canvas and on the board; the caption at the desk.
// ===================================================================
import {
  boardLines,
  captionLines,
} from "../src/pixel-office/public/office-view.js";
import { ROLE_NAMES, ROLE_UNKNOWN } from "../src/pixel-office/public/texts.js";

// The lines of the caption of a desk in a frame, by the place of the seat.
function captionAt(calls, o, key) {
  const c = charOf(o, key);
  const [sx, sy] = o.layout.desks[c.desk_index].seat;
  return calls
    .filter(
      (x) =>
        x.op === "fillText" &&
        x.font === LABEL_FONT &&
        x.args[1] === sx * 24 + 12 &&
        (x.args[2] === sy * 24 + 31 || x.args[2] === sy * 24 + 41),
    )
    .sort((a, b) => a.args[2] - b.args[2]);
}
const joinLines = (lines) =>
  lines.length < 2
    ? (lines[0] ?? "")
    : lines[0].endsWith("-")
      ? lines[0] + lines[1]
      : `${lines[0]} ${lines[1]}`;
// The lines of the name of a column of the board (bold 7px, maxWidth 52).
function boardColumnLines(calls) {
  return calls.filter(
    (x) => x.op === "fillText" && x.font === "bold 7px system-ui",
  );
}

test("LW-01: one name of a role on the canvas and on the board - 'Sai Security Reviewer (SECURITY-REVIEWER)', 'Explore' and a task without a role give 'Проверка безопасности', 'Explore' and '(роль не указана)' at the desk and on the board; roleLabel builds no caption in the code of the page", () => {
  const roles = [
    ["Sai Security Reviewer (SECURITY-REVIEWER)", "Проверка безопасности"],
    ["Explore", "Explore"],
    [undefined, "(роль не указана)"],
  ];
  const j = journal();
  j.sessionStart("S1");
  roles.forEach(([role], i) => j.subStart("S1", `a${i}`, role));
  const { o } = mk(j.entries);
  const ctx = makeCtx();
  drawOffice(ctx, o, seatedFrame(o, 24));
  const calls = ctx.lastFrame();
  for (const [role, name] of roles) {
    const key = `role:${role ?? ROLE_UNKNOWN}`;
    assert.equal(charOf(o, key).label, name, key);
    const lines = captionAt(calls, o, key).map((x) => x.args[0]);
    assert.equal(joinLines(lines), name, `${key}: the caption at the desk`);
  }
  // the board: the names of the three columns
  const board = boardColumnLines(calls);
  for (const [, name] of roles) {
    const mine = board.filter((x) => name.startsWith(x.args[0]));
    assert.ok(mine.length >= 1, `${name} on the board`);
  }
  assert.deepEqual(
    o.board.columns.map((c) => c.label),
    roles.map(([, name]) => name),
  );
  // the short caption of roleLabel is drawn nowhere
  const drawn = calls.filter((x) => x.op === "fillText").map((x) => x.args[0]);
  assert.equal(drawn.includes("SECURITY-REVIEW…"), false);
  // roleLabel( is called nowhere in the page but its own definition
  const calls_ = [];
  for (const name of fs.readdirSync(PUBLIC)) {
    fs.readFileSync(path.join(PUBLIC, name), "utf8")
      .split("\n")
      .forEach((line, i) => {
        if (line.includes("roleLabel(") && !line.includes("export function")) {
          calls_.push(`${name}:${i + 1}`);
        }
      });
  }
  assert.deepEqual(calls_, []);
});

test("LW-03: the caption and the board name whole, without '…' and without overlap - every name of ROLE_NAMES and a role of 128 characters: at most two lines that make the name, the second from a whole word; a word wider than 130 is a line by itself; 19 desks with the 18 longest names - no two captions overlap, also with B at the desk of A and two walking side by side; the board lines make the name and are narrowed to 3/4 at most; '+N' does not touch the third column or the frame", () => {
  const ctx = makeCtx();
  ctx.font = LABEL_FONT;
  const width = (t) => 0.6 * 9 * Array.from(t).length;
  const long = "Z".repeat(128);
  for (const name of [...Object.values(ROLE_NAMES), long]) {
    const lines = captionLines(ctx, name, 130);
    assert.ok(lines.length >= 1 && lines.length <= 2, name);
    assert.equal(joinLines(lines), name, name);
    for (const line of lines) assert.equal(line.includes("…"), false);
    if (lines.length === 2 && !lines[0].endsWith("-")) {
      // the first line is the longest beginning of whole words that fits
      const words = name.split(" ");
      const firstWords = lines[0].split(" ").length;
      assert.equal(lines[1], words.slice(firstWords).join(" "), name);
      if (firstWords < words.length && width(lines[0]) <= 130) {
        const more = words.slice(0, firstWords + 1).join(" ");
        assert.ok(width(more) > 130, `${name}: one more word would fit`);
      }
    }
  }
  // design D3 (L1): a first word wider than 130 is a line by itself
  const wide = `${"Ш".repeat(40)} Образец`;
  assert.deepEqual(captionLines(ctx, wide, 130), ["Ш".repeat(40), "Образец"]);
  // the 18 longest names at 19 desks: no overlap
  const byName = new Map(
    agentNames().map((full) => [
      ROLE_NAMES[/\(([A-Z][A-Z0-9-]*)\)$/.exec(full)[1]],
      full,
    ]),
  );
  const longest = [...byName.keys()]
    .sort((a, b) => width(b) - width(a))
    .slice(0, 18);
  const j = journal();
  j.sessionStart("S1");
  longest.forEach((name, i) => j.subStart("S1", `r${i}`, byName.get(name)));
  const { o } = mk(j.entries);
  assert.equal(o.characters.length, 19);
  const boxes = (calls) =>
    calls
      .filter(
        (x) =>
          x.op === "fillText" &&
          x.font === LABEL_FONT &&
          o.layout.desks.some(
            (d) =>
              x.args[1] === d.seat[0] * 24 + 12 &&
              (x.args[2] === d.seat[1] * 24 + 31 ||
                x.args[2] === d.seat[1] * 24 + 41),
          ),
      )
      .map((x) => {
        const w = Math.min(width(x.args[0]), x.args[3] ?? Infinity);
        return {
          text: x.args[0],
          l: x.args[1] - w / 2,
          r: x.args[1] + w / 2,
          t: x.args[2] - 8,
          b: x.args[2] + 3,
        };
      });
  const overlap = (a, b) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
  // the two lines of one caption (same centre, 10 apart) make one box
  const captions = (calls) => {
    const list = boxes(calls).sort((a, b) => a.t - b.t);
    const out = [];
    for (const box of list) {
      const prev = out.find(
        (c) => c.x === (box.l + box.r) / 2 && c.lastT === box.t - 10,
      );
      if (prev === undefined) {
        out.push({ ...box, x: (box.l + box.r) / 2, lastT: box.t });
      } else {
        prev.text = `${prev.text} / ${box.text}`;
        prev.l = Math.min(prev.l, box.l);
        prev.r = Math.max(prev.r, box.r);
        prev.b = box.b;
        prev.lastT = box.t;
      }
    }
    return out;
  };
  const checkNoOverlap = (calls, why) => {
    const list = captions(calls);
    for (let i = 0; i < list.length; i++) {
      for (let k = i + 1; k < list.length; k++) {
        assert.equal(
          overlap(list[i], list[k]),
          false,
          `${why}: '${list[i].text}' and '${list[k].text}'`,
        );
      }
    }
    return list;
  };
  const seated = makeCtx();
  drawOffice(seated, o, seatedFrame(o, 24));
  const seatedBoxes = checkNoOverlap(seated.lastFrame(), "seated");
  for (const name of longest) {
    const lines = captionAt(seated.lastFrame(), o, `role:${byName.get(name)}`);
    assert.equal(joinLines(lines.map((x) => x.args[0])), name);
    assert.ok(lines.length <= 2);
  }
  assert.equal(seatedBoxes.length, 19);
  // roles out of the table whose second line is wider than 130: it is drawn
  // narrowed to 130 (fillText maxWidth), and the captions still do not meet
  const jw = journal();
  jw.sessionStart("S1");
  for (let i = 0; i < 18; i++) {
    const letter = String.fromCharCode(1040 + i);
    jw.subStart(
      "S1",
      `w${i}`,
      `Образец ${letter.repeat(30)} ${letter.repeat(30)}`,
    );
  }
  const ow = mk(jw.entries).o;
  const wideCtx = makeCtx();
  drawOffice(wideCtx, ow, seatedFrame(ow, 24));
  const wideCalls = wideCtx
    .lastFrame()
    .filter((x) => x.op === "fillText" && x.font === LABEL_FONT);
  let narrowed = 0;
  for (const x of wideCalls) {
    if (width(x.args[0]) > 130) {
      assert.equal(x.args[3], 130, `'${x.args[0]}' is narrowed to 130`);
      narrowed += 1;
    }
  }
  assert.ok(narrowed >= 18);
  {
    const list = wideCalls
      .filter((x) =>
        ow.layout.desks.some(
          (d) =>
            x.args[1] === d.seat[0] * 24 + 12 &&
            (x.args[2] === d.seat[1] * 24 + 31 ||
              x.args[2] === d.seat[1] * 24 + 41),
        ),
      )
      .map((x) => {
        const w = Math.min(width(x.args[0]), x.args[3] ?? Infinity);
        return {
          text: x.args[0],
          l: x.args[1] - w / 2,
          r: x.args[1] + w / 2,
          t: x.args[2] - 8,
          b: x.args[2] + 2,
        };
      });
    for (let i = 0; i < list.length; i++) {
      for (let k = i + 1; k < list.length; k++) {
        assert.equal(
          overlap(list[i], list[k]),
          false,
          `'${list[i].text}' and '${list[k].text}'`,
        );
      }
    }
  }
  // B on the cell of approach of A's desk and walking near it; two walking side
  // by side: captions stay at the desks, none at the walkers
  const keyA = `role:${byName.get(longest[0])}`;
  const keyB = `role:${byName.get(longest[1])}`;
  const spotA = o.layout.desks[charOf(o, keyA).desk_index];
  for (const [bx, by] of [
    spotA.approach,
    [spotA.approach[0] + 1, spotA.approach[1]],
  ]) {
    const frame = seatedFrame(o, 24);
    frame.positions = frame.positions.map((p) =>
      p.key === keyB ? { ...p, x: bx, y: by, state: "walking" } : p,
    );
    const c = makeCtx();
    drawOffice(c, o, frame);
    const list = checkNoOverlap(c.lastFrame(), `B at ${bx},${by}`);
    assert.equal(list.length, seatedBoxes.length, "no caption at a walker");
  }
  const two = seatedFrame(o, 24);
  two.positions = two.positions.map((p, i) =>
    i === 1 || i === 2 ? { ...p, x: 10 + i, y: 9, state: "walking" } : p,
  );
  const c2 = makeCtx();
  drawOffice(c2, o, two);
  assert.equal(
    checkNoOverlap(c2.lastFrame(), "two walking").length,
    seatedBoxes.length,
  );
  // the board: lines make the name, narrowed to 3/4 at most
  const boardCtx = makeCtx();
  boardCtx.font = "bold 7px system-ui";
  for (const name of Object.values(ROLE_NAMES)) {
    const lines = boardLines(boardCtx, name, 52);
    assert.ok(lines.length >= 1 && lines.length <= 3, name);
    assert.equal(lines.join(" "), name);
    for (const line of lines) {
      const measured = 0.6 * 7 * Array.from(line).length;
      assert.ok(
        Math.min(52, measured) / measured >= 0.75,
        `${name}: '${line}'`,
      );
    }
  }
  const drawnBoard = boardColumnLines(seated.lastFrame());
  assert.ok(drawnBoard.length >= 3);
  for (const x of drawnBoard) {
    assert.equal(x.args[3], 52);
    const measured = 0.6 * 7 * Array.from(x.args[0]).length;
    assert.ok(52 / measured >= 0.75 || measured <= 52, x.args[0]);
  }
  // "+N": centre 852, maxWidth 16 - between the third column (ends 842) and
  // the frame (862)
  const plus = seated
    .lastFrame()
    .find((x) => x.op === "fillText" && /^\+\d+$/.test(x.args[0]));
  assert.ok(plus !== undefined);
  assert.deepEqual(plus.args.slice(1), [852, 40, 16]);
  const half = Math.min(16, 0.6 * 8 * plus.args[0].length) / 2;
  assert.ok(852 - half >= 842 && 852 + half <= 862);
  assert.equal(o.board.columns.length, 3);
});
