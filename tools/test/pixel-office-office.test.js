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
  canvasPoint,
  drawOffice,
  hitTest,
} from "../src/pixel-office/public/office-view.js";
import {
  FIXED_CELLS,
  buildLayout,
  canStep,
  cellKind,
  deskSpot,
} from "../src/pixel-office/public/layout.js";
import {
  buildReport,
  runReport,
} from "../src/pixel-office/public/office-report.js";
import {
  BUBBLE_TEXTS,
  CANVAS_UNSUPPORTED,
  CARD_SESSIONS,
  CARD_WORKING,
  LEGEND_IDLE,
  LEGEND_IDLE_MAIN,
  LEGEND_WORKING,
  ROOM_LABELS,
} from "../src/pixel-office/public/texts.js";
import {
  NOW,
  PUBLIC,
  REPORT_JS,
  T0,
  agentFiles,
  agentNames,
  at,
  entryOf,
  journal,
  makeCtx,
  makePage,
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
  page.canvas.rect = {
    left: 0,
    top: 0,
    width: page.canvas.width,
    height: page.canvas.height,
  };
  const k = 24;
  page.canvas.click({
    clientX: (seat[0] - office.layout.min_x) * k + 12,
    clientY: seat[1] * k + 12,
  });
}

test("OF-10: the card - the role, its tasks in progress, up to 5 completed, up to 10 trusted events; the title is the full name; a click selects and opens it; one more event changes the views together", async () => {
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
  assert.equal(card.label, "ORCH");
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
  assert.equal(page.el("card").byClass("card-title")[0].textContent, role);
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
  assert.equal(
    page.el("card").byClass("card-working")[0].textContent,
    `${CARD_WORKING}2`,
  );
});

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
  // the whole journal: the server start makes the task of S2 unrecorded
  const all = JSON.parse(runReportChild(["--journal", file]).stdout);
  assert.equal(all.session, null);
  assert.equal(all.roles.length, 2);
  const explore = all.roles.find((x) => x.role === "Explore");
  assert.equal(explore.working, false);
  assert.equal(explore.counts.unrecorded, 1);
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

test("OF-16: the legend - a button per character in the order of the desks; the full name and the state; data-color only on the working ones, equal to the colour; the state changes at once", async () => {
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
    { name: "Sai Orchestrator (ORCH)", state: LEGEND_WORKING, color: "1" },
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
    name: "Sai Orchestrator (ORCH)",
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
  // 4. a new grid: a partition appears across the path of a walker
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
  const runWalk = (growAt) => {
    const small = { layout: buildLayout(2), characters: chars2(2), routes: [] };
    const big = { layout: buildLayout(3), characters: chars2(3), routes: [] };
    const sim = createSim();
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
          canStep(layout, prev[0], prev[1], c[0], c[1]),
          true,
          `a step across a barrier at frame ${i}: ${prev} -> ${c}`,
        );
      }
      cells.push(c);
      if (i > 60 && sim.positions().every((p) => p.state === "seated")) break;
    }
    const seat = layout.desks[1].seat;
    assert.deepEqual(sim.cell("role:r1"), seat, "the walker came home");
    return cells;
  };
  const grown = runWalk(30);
  const steady = runWalk(-1);
  assert.notDeepEqual(grown, steady, "the new partition changed the path");
  // a new grid that does not close the path leaves it as it was
  const crossingFree = (growAt) => {
    const small = { layout: buildLayout(2), characters: chars2(2), routes: [] };
    const big = { layout: buildLayout(3), characters: chars2(3), routes: [] };
    const sim = createSim();
    sim.sync(small);
    sim.enqueue([
      { ...route(small.layout), to_cell: [13, 4], id: "10:handoff" },
    ]);
    const cells = [];
    for (let i = 0; i < 3000; i++) {
      if (i === growAt) sim.sync(big);
      sim.tick(1 / 60);
      cells.push(sim.cell("role:r1").join(","));
      if (i > 60 && sim.positions().every((p) => p.state === "seated")) break;
    }
    return cells;
  };
  assert.deepEqual(crossingFree(20), crossingFree(-1));
});

// ----------------------------------------------------------------- OF-19

test("OF-19: captions - at most 16 code points on real agent_type and the three built-in types; the examples; brackets; one caption for two roles of different folders; the call fillText(label, X + 12, Y + 31, 130) with centered text", () => {
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
  const call = ctx.calls.find(
    (c) => c.op === "fillText" && c.args[0] === "ORCH" && c.args[3] === 130,
  );
  assert.deepEqual(call.args, [
    "ORCH",
    seat[0] * 24 + 12,
    seat[1] * 24 + 31,
    130,
  ]);
  assert.equal(call.textAlign, "center");
  assert.equal(call.font, LABEL_FONT);
});

// ----------------------------------------------------------------- OF-20

test("OF-20: a click - canvasPoint on a scaled canvas and with min_x = -18; hitTest limits and ties; a click beside clears the choice and opens no card", async () => {
  const layout = buildLayout(25);
  const canvas = {
    width: 1440,
    height: 900,
    getBoundingClientRect: () => ({
      left: 10,
      top: 20,
      width: 720,
      height: 450,
    }),
  };
  const p = canvasPoint(
    { clientX: 10 + 360, clientY: 20 + 225 },
    canvas,
    layout,
    24,
  );
  assert.equal(p.px, 720 + layout.min_x * 24);
  assert.equal(p.py, 450);
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
  page.canvas.rect = { left: 0, top: 0, width: 960, height: 600 };
  page.canvas.click({ clientX: 940, clientY: 590 });
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

test("OF-23: the card of the main session says the number of running sessions and no 'в работе'; the card of a role says 'в работе: M'", async () => {
  const j = journal();
  j.sessionStart("S1");
  j.sessionStart("S2");
  launch(j, "S1", "a1", "Explore");
  const page = makePage({ entries: [...j.entries] });
  await page.start();
  page.legend()[0].click();
  const main = page.el("card").byClass("card-working")[0].textContent;
  assert.equal(main, `${CARD_SESSIONS}2`);
  assert.equal(main.includes(CARD_WORKING), false);
  page.legend()[1].click();
  assert.equal(
    page.el("card").byClass("card-working")[0].textContent,
    `${CARD_WORKING}1`,
  );
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
  const io = reportIo();
  assert.equal(runReport(["--journal", file, "--session", "S2"], io), 0);
  const s2 = JSON.parse(io.out);
  const io2 = reportIo();
  assert.equal(runReport(["--journal", file], io2), 0);
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
        c.args[2] === 39,
    ),
    "board column",
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
  const texts = new Set(Object.values(BUBBLE_TEXTS));
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
    [stop, "main", BUBBLE_TEXTS.answer_ready],
    [subStop, "role:Explore", BUBBLE_TEXTS.done],
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
  assert.equal(
    look(mk(two.entries).o, T0 + 504_000, "main"),
    BUBBLE_TEXTS.answer_ready,
  );
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

test("OF-31: the board - columns only for roles of a running session, in the order of the desks, with the counts; five roles give 4 columns and '+N'; no running session - no columns; it changes at once", () => {
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
  assert.deepEqual(o.board.columns[0].counts, {
    in_progress: 1,
    completed: 0,
    unrecorded: 0,
  });
  assert.deepEqual(o.board.columns[1].counts, {
    in_progress: 0,
    completed: 1,
    unrecorded: 0,
  });
  assert.equal(o.board.more, 0);
  const unrec = mk(j.entries, [{ time: at(99), journal_lines: 7 }]);
  assert.equal(unrec.o.board.columns.length, 0, "no running session");
  // five roles
  const f = journal();
  f.sessionStart("A");
  for (let i = 0; i < 7; i++) launch(f, "A", `r${i}`, `Role ${i}`);
  o = mk(f.entries).o;
  assert.equal(o.board.columns.length, 4);
  assert.equal(o.board.more, 3);
  const ctx = frameOf(o);
  const plus = ctx.calls.find((c) => c.op === "fillText" && c.args[0] === "+3");
  assert.deepEqual(plus.args.slice(1), [854, 40]);
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
  // edges
  const wide = buildLayout(25);
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
    "Готово",
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
  // measurements of a stand: the panel is 1472 x 600; every legend entry is 30 px high
  const inner = page.el("office-inner");
  inner.clientWidth = 1472;
  inner.clientHeight = 600;
  Object.defineProperty(page.el("legend"), "offsetHeight", {
    get() {
      return this.children.length * 30;
    },
  });
  await page.start();
  assert.equal(page.legend().length, 3);
  const legendHeight = 3 * 30;
  const expected = Math.max(
    4,
    Math.floor(Math.min(1472 / 40, (600 - legendHeight) / 25)),
  );
  assert.equal(expected, 20);
  assert.equal(
    page.canvas.width,
    40 * expected,
    "the canvas leaves room for the legend",
  );
  assert.equal(page.canvas.height, 25 * expected);
  assert.ok(
    page.canvas.height + legendHeight <= 600,
    "the legend is not cut off",
  );
  // and after a rebuild with one more role
  launch(j, "S1", "a3", "Sai Orchestrator (ORCH)");
  await page.push(...j.entries.slice(-2));
  const again = Math.max(
    4,
    Math.floor(Math.min(1472 / 40, (600 - 4 * 30) / 25)),
  );
  assert.equal(page.canvas.width, 40 * again);
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
  page.canvas.width / 40,
  page.canvas.width,
  page.canvas.height,
];

test("OF-38: the canvas is fitted at a scale above 1 - rectangles first, whole numbers as the way out, the two modes are not mixed; the result depends only on the measures", async () => {
  const cases = [
    [{ width: 1472, height: 966, legend: 39, gap: 10 }, [36, 1440, 900]],
    [
      { width: 1963.33, height: 1288.67, legend: 52, gap: 13.33 },
      [48, 1920, 1200],
    ],
    [{ width: 3169, height: 1990, legend: 58.5, gap: 15 }, [76, 3040, 1900]],
    [{ width: 3169, height: 1990, legend: 91.5, gap: 15 }, [75, 3000, 1875]],
    [
      { width: 1963.33, height: 1448.67, legend: 52, gap: 13.33 },
      [49, 1960, 1225],
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
  assert.deepEqual(cellOf(ints), [48, 1920, 1200]);
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
    mixed.canvas.width / 40,
    Math.floor(Math.min(1472 / 40, 500 / 25)),
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
  assert.equal(half.canvas.width / 40, 20);
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
  assert.deepEqual(cellOf(rects), [48, 1920, 1200]);
  // the root size is not read: the stand's documentElement throws
  const page = await fittedPage((p) => {
    Object.defineProperty(p.doc, "documentElement", {
      get() {
        throw new Error("documentElement is read");
      },
    });
    setPanelRects(p, { width: 3169, height: 1990, legend: 58.5, gap: 15 });
  });
  assert.deepEqual(cellOf(page), [76, 3040, 1900]);
});

test("OF-38: resize - a new window gives new attributes and exactly one new frame; the same measures change nothing", async () => {
  const page = await fittedPage((p) =>
    setPanelRects(p, { width: 1472, height: 966, legend: 39, gap: 10 }),
  );
  assert.deepEqual(cellOf(page), [36, 1440, 900]);
  assert.ok(page.resizeListeners.length >= 1);
  const frames = () => page.ctx.frames().length;
  const before = frames();
  for (const fn of page.resizeListeners) fn();
  assert.deepEqual(cellOf(page), [36, 1440, 900]);
  assert.equal(frames(), before, "the same measures: no new frame");
  setPanelRects(page, {
    width: 1963.33,
    height: 1288.67,
    legend: 52,
    gap: 13.33,
  });
  for (const fn of page.resizeListeners) fn();
  assert.deepEqual(cellOf(page), [48, 1920, 1200]);
  assert.equal(frames(), before + 1, "one new frame");
  for (const fn of page.resizeListeners) fn();
  assert.equal(frames(), before + 1, "and no more");
});

test("OF-38: the canvas fonts do not depend on the cell - the same font strings at 24 and 48, setTransform scale is cellPx / 24", () => {
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
      bubbles: new Map([["main", { text: "Готово", event_index: 1 }]]),
      cellPx,
    });
    return ctx;
  };
  const a = run(24);
  const b = run(48);
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
  assert.equal(a.calls.find((c) => c.op === "setTransform").args[0], 1);
  assert.equal(b.calls.find((c) => c.op === "setTransform").args[0], 2);
});

test("OF-38: a failure - a NaN gap, a zero area or a missing rectangle gives the cell 24; the journal and the canvas stay as they were", async () => {
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
    assert.deepEqual(sizeBefore, [960, 600], JSON.stringify(m));
    assert.deepEqual([page.canvas.width, page.canvas.height], sizeBefore);
    assert.equal(JSON.stringify(page.server.entries), entries);
    assert.equal(page.rows().length, rows);
    assert.equal(page.app.getOffice().characters.length, 2);
  }
});
