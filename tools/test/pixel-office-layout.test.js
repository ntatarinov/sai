// LY: the grid of the office (design 10.2; REQ-007 criteria 1, 3, 4, 12).
// The formulas below are written out in the test from design 4.4, not read
// from the code under test.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  WALKABLE_KINDS,
  buildLayout,
  canStep,
  cellKind,
  deskSpot,
  findPath,
  officeSize,
  walkable,
  FIXED_CELLS,
} from "../src/pixel-office/public/layout.js";
import {
  drawOffice,
  drawStatic,
  fitCanvas,
} from "../src/pixel-office/public/office-view.js";
import { ROOM_LABELS } from "../src/pixel-office/public/texts.js";
import {
  FakeDocument,
  agentFiles,
  indexHtml,
  makeCtx,
} from "./pixel-office-helpers.js";

const K = agentFiles().length;
const COUNTS_P23 = [
  0, 1, 2, 3, 12, 13, 14, 15, 24, 25, 38, 41, 48, 49, 72, 73, 121,
];
const NS = [1, K + 3, 3 * (K + 3)];
const DS = [...new Set([...COUNTS_P23, ...NS.map((n) => n + 1)])].sort(
  (a, b) => a - b,
);

// design 4.4
function expectedSize(d) {
  const bays = Math.max(1, Math.ceil(d / 12));
  const bayColumns = Math.ceil(bays / 2);
  const minX = -18 * (bayColumns - 1);
  return {
    bays,
    bay_columns: bayColumns,
    min_x: minX,
    max_x: 39,
    width: 39 - minX + 1,
    height: bays === 1 ? 25 : 34,
  };
}

function expectedSpot(d) {
  const bay = Math.floor(d / 12);
  const i = d % 12;
  const col = i % 3;
  const row = Math.floor(i / 3);
  const X = 1 - 18 * Math.floor(bay / 2);
  const Y = 1 + 16 * (bay % 2);
  return {
    block: [X + 2 + 6 * col, Y + 1 + 4 * row],
    seat: [X + 4 + 6 * col, Y + 2 + 4 * row],
    approach: [X + 5 + 6 * col, Y + 2 + 4 * row],
  };
}

function cells(layout) {
  const out = [];
  for (let y = 0; y < layout.height; y++) {
    for (let x = layout.min_x; x <= layout.max_x; x++) out.push([x, y]);
  }
  return out;
}

// a breadth-first search of the test over canStep
function bfs(layout, from) {
  const dist = new Map();
  const key = (x, y) => `${x},${y}`;
  dist.set(key(...from), 0);
  let frontier = [from];
  while (frontier.length > 0) {
    const next = [];
    for (const [x, y] of frontier) {
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nx = x + dx;
        const ny = y + dy;
        if (dist.has(key(nx, ny))) continue;
        if (!canStep(layout, x, y, nx, ny)) continue;
        dist.set(key(nx, ny), dist.get(key(x, y)) + 1);
        next.push([nx, ny]);
      }
    }
    frontier = next;
  }
  return dist;
}

const kindAt = (layout, [x, y]) => cellKind(layout, x, y);

test("LY-01: officeSize and buildLayout match the table of 4.4 for every desk count; the layout is frozen; cells outside are outside and not walkable", () => {
  for (const d of DS) {
    const size = officeSize(d);
    const e = expectedSize(d);
    for (const key of Object.keys(e))
      assert.equal(size[key], e[key], `${d}: ${key}`);
    const layout = buildLayout(d);
    assert.equal(Object.isFrozen(layout), true);
    assert.equal(layout.desks.length, d);
    for (const key of Object.keys(e)) assert.equal(layout[key], e[key]);
    for (const [x, y] of [
      [layout.min_x - 1, 3],
      [layout.max_x + 1, 3],
      [5, -1],
      [5, layout.height],
    ]) {
      assert.equal(cellKind(layout, x, y), "outside");
      assert.equal(walkable(layout, x, y), false);
    }
  }
});

test("LY-02: desks equal deskSpot(d); N roles and the main session have N + 1 distinct desks; blocks are desk, seats are seat; a laptop and a chair are drawn on every occupied desk; places do not move when a role appears", () => {
  for (const n of NS) {
    const d = n + 1;
    const layout = buildLayout(d);
    const seen = new Set();
    for (let i = 0; i < d; i++) {
      const spot = layout.desks[i];
      const e = expectedSpot(i);
      assert.deepEqual(spot.block, e.block);
      assert.deepEqual(spot.seat, e.seat);
      assert.deepEqual(spot.approach, e.approach);
      assert.deepEqual(spot, deskSpot(i));
      seen.add(spot.block.join(","));
      for (const dx of [0, 1]) {
        for (const dy of [0, 1]) {
          assert.equal(
            cellKind(layout, spot.block[0] + dx, spot.block[1] + dy),
            "desk",
          );
        }
      }
      assert.equal(kindAt(layout, spot.seat), "seat");
    }
    assert.equal(seen.size, d);
    // drawing: a laptop (screen and base) and a chair on every occupied desk
    const ctx = makeCtx();
    const characters = layout.desks.map((s, i) => ({
      key: `k${i}`,
      kind: "role",
      full: `r${i}`,
      label: `r${i}`,
      desk_index: i,
      color: i === 0 ? 0 : 1 + ((i - 1) % 11),
      working: false,
      working_count: 0,
    }));
    drawOffice(
      ctx,
      { layout, characters, board: { columns: [], more: 0 } },
      { positions: [], selectedKey: null, bubbles: new Map(), cellPx: 24 },
    );
    const rects = ctx.calls
      .filter((c) => c.op === "fillRect")
      .map((c) => c.args.join(","));
    for (const spot of layout.desks) {
      const [bx, by] = spot.block.map((v) => v * 24);
      assert.ok(
        rects.includes([bx + 23, by + 5, 16, 11].join(",")),
        "laptop screen",
      );
      assert.ok(
        rects.includes([bx + 21, by + 16, 20, 3].join(",")),
        "laptop base",
      );
      assert.ok(
        rects.includes(
          [spot.seat[0] * 24 + 4, spot.seat[1] * 24 + 6, 16, 18].join(","),
        ),
        "chair",
      );
    }
    // the first N + 1 desks are the same with N + 1 roles
    const bigger = buildLayout(d + 1);
    for (let i = 0; i < d; i++) {
      assert.deepEqual(bigger.desks[i].seat, layout.desks[i].seat);
      assert.deepEqual(bigger.desks[i].approach, layout.desks[i].approach);
    }
  }
  for (const bad of [-1, 1.5, NaN, "3", null, undefined]) {
    assert.equal(deskSpot(bad), null, String(bad));
  }
});

test("LY-03: for every desk count the seat and the approach of every occupied desk are walkable (seat or floor) and connected to the seat of desk 0", () => {
  for (const d of DS) {
    const layout = buildLayout(d);
    if (d === 0) continue;
    const reach = bfs(layout, layout.desks[0].seat);
    for (const spot of layout.desks) {
      for (const [name, cell] of [
        ["seat", spot.seat],
        ["approach", spot.approach],
      ]) {
        assert.equal(walkable(layout, ...cell), true, `${d}: ${name} ${cell}`);
        const kind = kindAt(layout, cell);
        assert.ok(
          kind === "seat" || kind === "floor",
          `${d}: ${name} is ${kind}`,
        );
        assert.ok(
          reach.has(cell.join(",")),
          `${d}: ${name} ${cell} is cut off`,
        );
      }
    }
  }
});

test("LY-04: findPath uses only steps canStep allows, ends at the goal, is the shortest, keeps the order right-left-down-up, returns [] for the same cell and null for unreachable goals; its own step function is used", () => {
  const layout = buildLayout(25);
  const from = layout.desks[0].seat;
  const dist = bfs(layout, from);
  for (const i of [1, 5, 11, 12, 20, 24]) {
    const goal = layout.desks[i].approach;
    const path = findPath(layout, from, goal);
    assert.ok(path !== null);
    assert.deepEqual(path[path.length - 1], goal);
    assert.equal(path.length, dist.get(goal.join(",")));
    let prev = from;
    for (const cell of path) {
      assert.equal(canStep(layout, prev[0], prev[1], cell[0], cell[1]), true);
      prev = cell;
    }
    assert.deepEqual(
      findPath(layout, from, goal),
      path,
      "the same path on repeat",
    );
  }
  assert.deepEqual(findPath(layout, from, from), []);
  // order of directions in an open area
  assert.deepEqual(findPath(layout, [25, 9], [26, 10]), [
    [26, 9],
    [26, 10],
  ]);
  assert.deepEqual(findPath(layout, [25, 9], [24, 8]), [
    [24, 9],
    [24, 8],
  ]);
  assert.deepEqual(findPath(layout, [25, 9], [25, 10]), [[25, 10]]);
  // unreachable goals
  const desk = layout.desks[3].block;
  assert.equal(findPath(layout, from, desk), null);
  assert.equal(findPath(layout, from, [0, 0]), null);
  assert.equal(
    findPath(layout, from, [
      layout.desks[0].block[0],
      layout.desks[0].block[1],
    ]),
    null,
  );
  assert.equal(findPath(layout, from, [2, 1]), null);
  assert.equal(findPath(layout, from, [100, 100]), null);
  const reserved = buildLayout(3);
  assert.equal(
    findPath(reserved, reserved.desks[0].seat, deskSpot(5).block),
    null,
  );
  assert.equal(findPath(layout, from, [28, 4]), null);
  // the step function that is passed is the one that is used
  assert.equal(
    findPath(layout, from, layout.desks[1].approach, () => false),
    null,
  );
  let used = 0;
  const counting = (l, x, y, nx, ny) => {
    used += 1;
    return canStep(l, x, y, nx, ny);
  };
  assert.ok(
    findPath(layout, from, layout.desks[1].approach, counting) !== null,
  );
  assert.ok(used > 0);
  const noRight = (l, x, y, nx, ny) => nx <= x && canStep(l, x, y, nx, ny);
  const left = findPath(
    layout,
    layout.desks[1].seat,
    layout.desks[0].seat,
    noRight,
  );
  assert.ok(
    left === null || left.every((c, i) => i === 0 || c[0] <= left[i - 1][0]),
  );
});

test("LY-05: the fixed layer is the same for any number of desks; three rooms with their furniture; labels and their calls in a frame", () => {
  const kinds = (layout) => FIXED_CELLS.map(([x, y]) => cellKind(layout, x, y));
  const base = kinds(buildLayout(0));
  for (const d of [2, K + 4, 3 * (K + 3) + 1]) {
    assert.deepEqual(kinds(buildLayout(d)), base, `D = ${d}`);
  }
  const layout = buildLayout(0);
  const all = (xs, ys, kind) => {
    for (const x of xs) {
      for (const y of ys)
        assert.equal(cellKind(layout, x, y), kind, `${x},${y}`);
    }
  };
  const range = (a, b) => Array.from({ length: b - a + 1 }, (_v, i) => a + i);
  // meeting room: a big table, chairs around it, a board
  all(range(28, 35), [3, 4, 5], "table");
  all(range(28, 35), [1, 2], "board");
  all([26, 37], [3, 4, 5], "chair");
  // the lower row of chairs of the meeting room and the rest places of the hall
  all([28, 30, 32, 34], [6], "chair");
  all([30, 32], [20], "chair");
  // kitchen: a counter and chairs
  all([36, 37], [11, 12], "counter");
  assert.equal(cellKind(layout, 34, 11), "chair");
  assert.equal(cellKind(layout, 34, 13), "chair");
  // server room: racks behind walls
  all([26, 27, 28], [13, 14], "server");
  all(range(23, 31), [11], "wall");
  // plants and shelves
  for (const [x, y] of [
    [1, 1],
    [1, 23],
    [38, 1],
    [38, 16],
  ])
    assert.equal(cellKind(layout, x, y), "plant");
  for (const [x, y] of [
    [2, 1],
    [3, 1],
    [37, 1],
  ])
    assert.equal(cellKind(layout, x, y), "shelf");
  // captions
  assert.deepEqual(Object.values(ROOM_LABELS).sort(), [
    "КУХНЯ",
    "ПЕРЕГОВОРНАЯ",
    "СЕРВЕРНАЯ",
  ]);
  const ctx = makeCtx();
  drawOffice(
    ctx,
    { layout, characters: [], board: { columns: [], more: 0 } },
    { positions: [], selectedKey: null, bubbles: new Map(), cellPx: 24 },
  );
  const text = (s) =>
    ctx.calls.find((c) => c.op === "fillText" && c.args[0] === s);
  assert.deepEqual(text("ПЕРЕГОВОРНАЯ").args.slice(1), [580, 21]);
  assert.deepEqual(text("СЕРВЕРНАЯ").args.slice(1), [624, 309]);
  assert.deepEqual(text("КУХНЯ").args.slice(1), [842, 261]);
});

test("LY-06: partition lines exist exactly when the place 12b + 1 (x = X + 7) or 12b + 2 (x = X + 13) is occupied; canStep refuses a step across them in every row but the gap", () => {
  for (const d of [0, 1, 2, 3, 12, 13, 14, 15, 24, 25, 26, 27, 38, 49, 73]) {
    const layout = buildLayout(d);
    for (let bay = 0; bay < layout.bays; bay++) {
      const X = 1 - 18 * Math.floor(bay / 2);
      const Y = 1 + 16 * (bay % 2);
      for (const [offset, place] of [
        [7, 1],
        [13, 2],
      ]) {
        const closed = d > 12 * bay + place;
        const x = X + offset;
        for (let y = Y; y <= Y + 15; y++) {
          const expectBlocked = closed && y !== Y + 7;
          assert.equal(
            canStep(layout, x - 1, y, x, y),
            !expectBlocked,
            `D=${d} bay ${bay} x=${x} y=${y} right`,
          );
          assert.equal(
            canStep(layout, x, y, x - 1, y),
            !expectBlocked,
            `D=${d} bay ${bay} x=${x} y=${y} left`,
          );
        }
      }
    }
  }
  // bays 0 and 1: lines at x = 8 and x = 14 in rows 1-32, passages in rows 8 and 24
  const layout = buildLayout(25);
  for (const x of [8, 14]) {
    for (let y = 1; y <= 32; y++) {
      const gap = y === 8 || y === 24;
      assert.equal(canStep(layout, x - 1, y, x, y), gap, `x=${x} y=${y}`);
    }
  }
});

test("LY-07: what is drawn is what blocks - one base rectangle per cell in the colour of its kind, before the details; every partition line is two rectangles exactly on the closed borders", () => {
  const colorOf = (kind, x, y) => {
    // colours of the description of the interface (4.5), not of the code
    if (kind === "wall") return "#26344a";
    if (kind === "tile") return "#1b2a3d";
    return (((x + y) % 2) + 2) % 2 === 0 ? "#131b27" : "#151e2b";
  };
  for (const d of [0, 13, K + 4]) {
    const layout = buildLayout(d);
    const ctx = makeCtx();
    drawStatic(ctx, layout);
    const rects = ctx.calls.filter((c) => c.op === "fillRect");
    const total = layout.width * layout.height;
    for (const [x, y] of cells(layout)) {
      const same = rects.filter(
        (c) => c.args.join(",") === [x * 24, y * 24, 24, 24].join(","),
      );
      assert.equal(same.length, 1, `${d}: cell ${x},${y}`);
      assert.equal(
        same[0].fillStyle,
        colorOf(cellKind(layout, x, y), x, y),
        `${d}: ${x},${y}`,
      );
      assert.ok(
        rects.indexOf(same[0]) < total,
        "a base comes before the details",
      );
    }
    // partitions: two rectangles of width 2 per line, exactly on closed borders
    const lines = rects
      .slice(total)
      .filter((c) => c.args[2] === 2 && c.args[3] >= 24);
    const closedBorders = [];
    for (const [x, y] of cells(layout)) {
      if (
        walkable(layout, x, y) &&
        walkable(layout, x - 1, y) &&
        !canStep(layout, x - 1, y, x, y)
      ) {
        closedBorders.push([x, y]);
      }
    }
    for (const [x, y] of closedBorders) {
      const covered = lines.some(
        (c) =>
          c.args[0] === x * 24 - 1 &&
          y * 24 >= c.args[1] &&
          y * 24 + 23 < c.args[1] + c.args[3],
      );
      assert.ok(covered, `${d}: the closed border ${x},${y} is not drawn`);
    }
    let drawnCells = 0;
    for (const c of lines) {
      const x = (c.args[0] + 1) / 24;
      const rows = c.args[3] / 24;
      for (let r = 0; r < rows; r++) {
        const y = c.args[1] / 24 + r;
        drawnCells += 1;
        assert.equal(
          canStep(layout, x - 1, y, x, y),
          false,
          `${d}: a line over an open border ${x},${y}`,
        );
      }
    }
    assert.equal(
      drawnCells,
      closedBorders.length,
      `${d}: drawn borders = closed borders`,
    );
    assert.equal(lines.length % 2, 0);
  }
});

test("LY-08: growth never closes a walkable cell; seats and approaches are never in the block of rooms", () => {
  const top = 3 * (K + 3) + 1;
  let prev = buildLayout(0);
  for (let d = 1; d <= top; d++) {
    const next = buildLayout(d);
    for (const [x, y] of cells(prev)) {
      if (walkable(prev, x, y)) {
        assert.equal(
          walkable(next, x, y),
          true,
          `D ${d - 1} -> ${d}: ${x},${y} was closed`,
        );
      }
    }
    prev = next;
  }
  const layout = buildLayout(top);
  for (const spot of layout.desks) {
    for (const [x, y] of [spot.seat, spot.approach]) {
      assert.equal(
        x >= 23 && y <= 23,
        false,
        `${x},${y} in the block of rooms`,
      );
    }
  }
});

test("LY-09: walkable is exactly the walkable kinds; every other kind is impassable", () => {
  const layout = buildLayout(13);
  const seen = new Set();
  for (const [x, y] of cells(layout)) {
    const kind = cellKind(layout, x, y);
    seen.add(kind);
    assert.equal(walkable(layout, x, y), WALKABLE_KINDS.has(kind));
  }
  for (const kind of [
    "wall",
    "desk",
    "reserved",
    "table",
    "chair",
    "board",
    "counter",
    "server",
    "plant",
    "shelf",
  ]) {
    assert.ok(seen.has(kind), `no cell of kind ${kind}`);
    assert.equal(WALKABLE_KINDS.has(kind), false, kind);
  }
  for (const kind of ["floor", "tile", "seat"]) {
    assert.ok(seen.has(kind), `no cell of kind ${kind}`);
    assert.equal(WALKABLE_KINDS.has(kind), true, kind);
  }
  assert.equal(walkable(layout, 500, 500), false);
});

test("LY-10: buildLayout(3(K+3)+1) and a breadth-first search over the whole office take at most 200 ms", () => {
  const top = 3 * (K + 3) + 1;
  const t0 = performance.now();
  const layout = buildLayout(top + 7);
  const reach = bfs(layout, layout.desks[0].seat);
  const ms = performance.now() - t0;
  assert.ok(reach.size > 100);
  assert.ok(ms <= 200, `took ${ms} ms`);
});

test("LY-11: fitCanvas - a whole number of pixels per cell, max(4, floor(min(w/cols, h/rows))); the examples; a bad area gives 24; too wide an office gives 4", () => {
  const small = buildLayout(0);
  assert.deepEqual(fitCanvas(small, { width: 1472, height: 900 }), {
    cellPx: 36,
    width: 1440,
    height: 900,
  });
  const large = buildLayout(25);
  assert.equal(large.width, 58);
  assert.equal(large.height, 34);
  assert.equal(fitCanvas(large, { width: 1472, height: 760 }).cellPx, 22);
  assert.equal(fitCanvas(small, { width: 1472, height: Infinity }).cellPx, 36);
  for (const area of [
    { width: 0, height: 0 },
    { width: -5, height: 100 },
    { width: NaN, height: NaN },
    undefined,
    null,
  ]) {
    assert.equal(fitCanvas(small, area).cellPx, 24, JSON.stringify(area));
  }
  assert.equal(fitCanvas(small, { width: 100, height: 600 }).cellPx, 4);
  for (const w of [97, 333, 1001, 1472, 2000]) {
    for (const h of [100, 555, 900, 1200]) {
      const size = fitCanvas(large, { width: w, height: h });
      assert.ok(Number.isInteger(size.cellPx));
      assert.equal(
        size.cellPx,
        Math.max(4, Math.floor(Math.min(w / 58, h / 34))),
      );
      assert.equal(size.width, 58 * size.cellPx);
    }
  }
});

test("LY-11 (extension): the canvas at 1440 x 900 and 1920 x 1200 and the 2K and 4K examples; the cell in 2K is not smaller than in Full HD", () => {
  const small = buildLayout(0);
  assert.equal(small.width, 40);
  assert.equal(small.height, 25);
  const at = (width, height) => fitCanvas(small, { width, height });
  assert.deepEqual(at(1472, 917), { cellPx: 36, width: 1440, height: 900 });
  assert.deepEqual(at(1963.33, 1223.33), {
    cellPx: 48,
    width: 1920,
    height: 1200,
  });
  assert.deepEqual(at(1963.33, 1383.33), {
    cellPx: 49,
    width: 1960,
    height: 1225,
  });
  assert.deepEqual(at(3169, 1916.5), { cellPx: 76, width: 3040, height: 1900 });
  assert.equal(at(3169, 1883.5).cellPx, 75);
  assert.ok(at(1963.33, 1223.33).cellPx >= at(1472, 917).cellPx);
  assert.ok(at(3169, 1916.5).cellPx >= at(1963.33, 1223.33).cellPx);
  for (const size of [at(1963.33, 1223.33), at(3169, 1916.5)]) {
    assert.ok(Number.isInteger(size.cellPx));
  }
});

test("LY-12: <canvas id='office'> has width 960 and height 600 (officeSize(0) x 24) and no style attribute", () => {
  const doc = new FakeDocument(indexHtml());
  const canvas = doc.getElementById("office");
  assert.equal(canvas.getAttribute("width"), "960");
  assert.equal(canvas.getAttribute("height"), "600");
  assert.equal(canvas.hasAttribute("style"), false);
  const size = officeSize(0);
  assert.equal(size.width * 24, 960);
  assert.equal(size.height * 24, 600);
});
