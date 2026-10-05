// LY: the grid of the office (design 10.2; REQ-007 criteria 1, 3, 4, 12).
// The formulas below are written out in the test from design 4.15 (geometry
// of version 3.2, replacing 4.4), not read from the code under test.
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
  FIGURE_BOTTOM,
  FIGURE_TOP,
  LABEL_FONT_UNITS,
  MIN_CELL_PX,
  MIN_FIGURE_PX,
  MIN_LABEL_PX,
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

// design 4.15, 2: three main columns of 7 places, extra columns to the left
function extraOf(d) {
  return Math.max(0, Math.ceil((d - 21) / 7));
}

function expectedSize(d) {
  const extra = extraOf(d);
  const minX = extra === 0 ? 5 : 6 - 6 * extra;
  return {
    extra_columns: extra,
    columns: 3 + extra,
    min_x: minX,
    max_x: 39,
    width: 39 - minX + 1,
    height: 22,
  };
}

function expectedSpot(d) {
  const column = d < 21 ? d % 3 : -1 - Math.floor((d - 21) / 7);
  const row = d < 21 ? Math.floor(d / 3) : (d - 21) % 7;
  const X = 6 + 6 * column;
  return {
    column,
    row,
    block: [X + 1, 1 + 3 * row],
    seat: [X + 3, 2 + 3 * row],
    approach: [X + 4, 2 + 3 * row],
  };
}

// The x of the partition cells of an office with d desks: X(j) + 5 for j
// from -E to 1.
function partitionXs(d) {
  const out = [];
  for (let j = -extraOf(d); j <= 1; j++) out.push(6 + 6 * j + 5);
  return out;
}

// Whether the line of the partition right of column j is drawn: both
// neighbouring columns have an occupied desk (an extra column always has one).
function lineDrawn(d, j) {
  const taken = (c) => (c >= 0 ? d > c : true);
  return taken(j) && taken(j + 1);
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

test("LY-01: officeSize and buildLayout match the table of 4.15 for every desk count; the layout is frozen; cells outside are outside and not walkable", () => {
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
      assert.equal(spot.column, e.column);
      assert.equal(spot.row, e.row);
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
  for (const d of [...new Set([...DS, 19, 21, 22, 28, 29, 40])]) {
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
  // 17 x 21 cells of the block of rooms and four pieces of decor
  assert.equal(FIXED_CELLS.length, 17 * 21 + 4);
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
    [6, 1],
    [6, 20],
    [38, 1],
    [38, 16],
  ])
    assert.equal(cellKind(layout, x, y), "plant");
  for (const [x, y] of [
    [12, 1],
    [18, 1],
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

test("LY-06: partition cells at x = X(j) + 5 for j from -E to 1 in rows 1-20 except the gap row 9; a line exists exactly when both neighbouring columns have an occupied desk; canStep refuses the partition cell in every row but the gap", () => {
  for (const d of [0, 1, 2, 3, 12, 19, 21, 22, 28, 29, 35, 36, 49, 73]) {
    const layout = buildLayout(d);
    const xs = partitionXs(d);
    for (const x of xs) {
      for (let y = 1; y <= 20; y++) {
        const gap = y === 9;
        assert.equal(
          cellKind(layout, x, y),
          gap ? "floor" : "partition",
          `D=${d} x=${x} y=${y}`,
        );
        assert.equal(
          canStep(layout, x - 1, y, x, y),
          gap,
          `D=${d} x=${x} y=${y} right`,
        );
        assert.equal(
          canStep(layout, x + 1, y, x, y),
          gap,
          `D=${d} x=${x} y=${y} left`,
        );
      }
    }
    // the lines: exactly the partitions between two taken columns, by x
    const expected = [];
    for (let j = -extraOf(d); j <= 1; j++) {
      if (lineDrawn(d, j)) expected.push(6 + 6 * j + 5);
    }
    assert.deepEqual(
      layout.partitions.map((p) => p.x),
      expected,
      `D=${d} lines`,
    );
    for (const p of layout.partitions) {
      assert.equal(p.top, 1);
      assert.equal(p.bottom, 20);
      assert.equal(p.gap, 9);
      assert.equal(p.x, 6 + 6 * p.column + 5);
    }
  }
  // 19 desks: lines at x = 11 and 17; one desk: no line; two desks: x = 11
  assert.deepEqual(
    buildLayout(19).partitions.map((p) => p.x),
    [11, 17],
  );
  assert.deepEqual(buildLayout(1).partitions, []);
  assert.deepEqual(
    buildLayout(2).partitions.map((p) => p.x),
    [11],
  );
});

test("LY-07: what is drawn is what blocks - one base rectangle per cell in the colour of its kind, before the details; every drawn partition is two rectangles in the middle of its impassable cells", () => {
  const colorOf = (kind, x, y) => {
    // colours of the description of the interface (4.5), not of the code
    if (kind === "wall") return "#26344a";
    if (kind === "tile") return "#1b2a3d";
    return (((x + y) % 2) + 2) % 2 === 0 ? "#131b27" : "#151e2b";
  };
  for (const d of [0, 2, 13, 19, 22, K + 4]) {
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
    // partitions: two rectangles of width 2 per drawn line, in the middle
    // of the partition cell; every cell under a line is an impassable
    // partition whose base is the floor
    const lines = rects
      .slice(total)
      .filter((c) => c.args[2] === 2 && c.args[3] >= 24);
    const expected = [];
    for (const p of layout.partitions) {
      expected.push([p.x * 24 + 11, 24, 2, 8 * 24].join(","));
      expected.push([p.x * 24 + 11, 10 * 24, 2, 11 * 24].join(","));
    }
    assert.deepEqual(
      lines.map((c) => c.args.join(",")),
      expected,
      `${d}: partition lines`,
    );
    for (const c of lines) {
      const x = (c.args[0] - 11) / 24;
      const rows = c.args[3] / 24;
      for (let r = 0; r < rows; r++) {
        const y = c.args[1] / 24 + r;
        assert.equal(cellKind(layout, x, y), "partition", `${d}: ${x},${y}`);
        assert.equal(walkable(layout, x, y), false, `${d}: ${x},${y}`);
        const base = rects.find(
          (q) => q.args.join(",") === [x * 24, y * 24, 24, 24].join(","),
        );
        assert.ok(
          base.fillStyle === "#131b27" || base.fillStyle === "#151e2b",
          `${d}: the base of ${x},${y} is the floor`,
        );
      }
    }
    assert.equal(lines.length, 2 * layout.partitions.length);
  }
});

test("LY-08: growth never closes a walkable cell; a partition cell is never walkable; seats and approaches are never in the block of rooms", () => {
  const top = 3 * (K + 3) + 1;
  let prev = buildLayout(0);
  for (let d = 1; d <= top; d++) {
    const next = buildLayout(d);
    for (const [x, y] of cells(next)) {
      if (cellKind(next, x, y) === "partition") {
        assert.equal(walkable(next, x, y), false, `D ${d}: ${x},${y}`);
      }
    }
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
        x >= 23 && y <= 20,
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
    "partition",
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

test("LY-11: fitCanvas - a whole number of pixels per cell, max(27, floor(min(w/cols, h/rows))); the examples; a bad area gives 27 and does not fit; too wide an office gives 27", () => {
  assert.equal(MIN_CELL_PX, 27);
  const small = buildLayout(0);
  assert.equal(small.width, 35);
  assert.equal(small.height, 22);
  assert.deepEqual(fitCanvas(small, { width: 1472, height: 900 }), {
    cellPx: 40,
    width: 1400,
    height: 880,
    fits: true,
  });
  const large = buildLayout(25);
  assert.equal(large.width, 40);
  assert.equal(large.height, 22);
  assert.equal(fitCanvas(large, { width: 1472, height: 760 }).cellPx, 34);
  assert.equal(fitCanvas(small, { width: 1472, height: Infinity }).cellPx, 42);
  for (const area of [
    { width: 0, height: 0 },
    { width: -5, height: 100 },
    { width: NaN, height: NaN },
    undefined,
    null,
  ]) {
    const size = fitCanvas(small, area);
    assert.equal(size.cellPx, 27, JSON.stringify(area));
    assert.equal(size.fits, false, JSON.stringify(area));
  }
  const narrow = fitCanvas(small, { width: 100, height: 600 });
  assert.equal(narrow.cellPx, 27);
  assert.equal(narrow.fits, false);
  for (const w of [97, 333, 1001, 1472, 2000]) {
    for (const h of [100, 555, 900, 1200]) {
      const size = fitCanvas(large, { width: w, height: h });
      assert.ok(Number.isInteger(size.cellPx));
      assert.equal(
        size.cellPx,
        Math.max(27, Math.floor(Math.min(w / 40, h / 22))),
      );
      assert.equal(size.width, 40 * size.cellPx);
      assert.equal(size.height, 22 * size.cellPx);
      assert.equal(size.fits, size.width <= w && size.height <= h);
    }
  }
});

test("LY-11 (extension): the canvas at Full HD and the 2K and 4K examples; the cell in 2K is not smaller than in Full HD", () => {
  const small = buildLayout(0);
  assert.equal(small.width, 35);
  assert.equal(small.height, 22);
  const at = (width, height) => fitCanvas(small, { width, height });
  assert.deepEqual(at(1472, 900), {
    cellPx: 40,
    width: 1400,
    height: 880,
    fits: true,
  });
  assert.deepEqual(at(1963.33, 1223.33), {
    cellPx: 55,
    width: 1925,
    height: 1210,
    fits: true,
  });
  assert.deepEqual(at(1963.33, 1383.33), {
    cellPx: 56,
    width: 1960,
    height: 1232,
    fits: true,
  });
  assert.deepEqual(at(3169, 1916.5), {
    cellPx: 87,
    width: 3045,
    height: 1914,
    fits: true,
  });
  assert.equal(at(3169, 1883.5).cellPx, 85);
  assert.ok(at(1963.33, 1223.33).cellPx >= at(1472, 900).cellPx);
  assert.ok(at(3169, 1916.5).cellPx >= at(1963.33, 1223.33).cellPx);
  for (const size of [at(1963.33, 1223.33), at(3169, 1916.5)]) {
    assert.ok(Number.isInteger(size.cellPx));
  }
});

test("LY-12: <canvas id='office'> has width 945 and height 594 (officeSize(0) x MIN_CELL_PX), is the only child of #office-scroll and has no style attribute", () => {
  const doc = new FakeDocument(indexHtml());
  const canvas = doc.getElementById("office");
  assert.equal(canvas.getAttribute("width"), "945");
  assert.equal(canvas.getAttribute("height"), "594");
  assert.equal(canvas.hasAttribute("style"), false);
  const scroll = doc.getElementById("office-scroll");
  assert.ok(scroll !== null);
  assert.equal(scroll.children.length, 1);
  assert.equal(scroll.children[0], canvas);
  assert.equal(scroll.hasAttribute("style"), false);
  const size = officeSize(0);
  assert.equal(size.width * MIN_CELL_PX, 945);
  assert.equal(size.height * MIN_CELL_PX, 594);
});

// ------------------------------------------------ design 4.15, 10: LY-13...LY-18

// Dead rows and columns (criterion 18(d), part 2): inside the outer wall a row
// or a column is empty when every one of its cells is floor. Returns the x of
// the empty columns, the y of the empty rows and the violations of the rules
// "no two empty ones in a row" and "an empty one never touches the outer wall".
function deadLines(layout) {
  const innerX = [];
  for (let x = layout.min_x + 1; x <= layout.max_x - 1; x++) innerX.push(x);
  const innerY = [];
  for (let y = 1; y <= layout.height - 2; y++) innerY.push(y);
  const columns = innerX.filter((x) =>
    innerY.every((y) => cellKind(layout, x, y) === "floor"),
  );
  const rows = innerY.filter((y) =>
    innerX.every((x) => cellKind(layout, x, y) === "floor"),
  );
  const bad = [];
  const check = (name, list, first, last) => {
    for (const v of list) {
      if (list.includes(v + 1)) bad.push(`${name} ${v} and ${v + 1} are empty`);
      if (v === first || v === last) bad.push(`${name} ${v} touches the wall`);
    }
  };
  check("column", columns, layout.min_x + 1, layout.max_x - 1);
  check("row", rows, 1, layout.height - 2);
  return { columns, rows, bad };
}

test("LY-13: the size limit (criterion 18(d), part 1) - 19 desks give exactly 35 x 22, within 36 x 22; the outer ring is wall along its whole length", () => {
  const layout = buildLayout(19);
  assert.equal(layout.width, 35);
  assert.equal(layout.height, 22);
  assert.ok(layout.width <= 36 && layout.height <= 22);
  assert.equal(layout.min_x, 5);
  assert.equal(layout.max_x, 39);
  for (let x = layout.min_x; x <= layout.max_x; x++) {
    assert.equal(cellKind(layout, x, 0), "wall", `top ${x}`);
    assert.equal(cellKind(layout, x, layout.height - 1), "wall", `bottom ${x}`);
  }
  for (let y = 0; y < layout.height; y++) {
    assert.equal(cellKind(layout, layout.min_x, y), "wall", `left ${y}`);
    assert.equal(cellKind(layout, layout.max_x, y), "wall", `right ${y}`);
  }
  // one row below and one column left of the office are outside
  assert.equal(cellKind(layout, 20, layout.height), "outside");
  assert.equal(cellKind(layout, layout.min_x - 1, 5), "outside");
});

test("LY-14: no dead rows and columns (criterion 18(d), part 2), apart from LY-13 - with 19 desks the empty columns are exactly x 10, 16 and 22 and the empty row is exactly y 9; no two empty ones side by side, none touches the outer wall", () => {
  const dead = deadLines(buildLayout(19));
  assert.deepEqual(dead.columns, [10, 16, 22]);
  assert.deepEqual(dead.rows, [9]);
  assert.deepEqual(dead.bad, []);
});

// the design map of buildLayout(19) (4.15, 2): x 5..39, y 0..21; '|' is a
// partition, 'D' a desk, 's' a seat, 'r' a reserved place
const MAP_19 = [
  "###################################",
  "#PDD..|BDD..|BDD..#.mmmWWWWWWWWmBP#",
  "#.DDs.|.DDs.|.DDs.#.mmmWWWWWWWWmmm#",
  "#.....|.....|.....#.mhmTTTTTTTTmhm#",
  "#.DD..|.DD..|.DD..#.mhmTTTTTTTTmhm#",
  "#.DDs.|.DDs.|.DDs.#.mhmTTTTTTTTmhm#",
  "#.....|.....|.....#.mmmhmhmhmhmmmm#",
  "#.DD..|.DD..|.DD..#####....########",
  "#.DDs.|.DDs.|.DDs.................#",
  "#.................................#",
  "#.DD..|.DD..|.DD..................#",
  "#.DDs.|.DDs.|.DDs.#########..h.KK.#",
  "#.....|.....|.....#.......#....KK.#",
  "#.DD..|.DD..|.DD..#..SSS..#..h....#",
  "#.DDs.|.DDs.|.DDs.#..SSS..#.......#",
  "#.....|.....|.....#.......#.......#",
  "#.DD..|.DD..|.DD..#########......P#",
  "#.DDs.|.DDs.|.DDs.................#",
  "#.....|.....|.....................#",
  "#.DD..|.rr..|.rr..................#",
  "#PDDs.|.rr..|.rr.........h.h......#",
  "###################################",
];
const MAP_KINDS = {
  "#": "wall",
  ".": "floor",
  m: "tile",
  W: "board",
  T: "table",
  h: "chair",
  K: "counter",
  S: "server",
  P: "plant",
  B: "shelf",
  "|": "partition",
  D: "desk",
  s: "seat",
  r: "reserved",
};

test("LY-15: the composition with 19 desks - every cell of the design map; three rooms with their captions, the board, the table, chairs, the counter, the racks; 19 distinct desks of 2 x 2 with a seat and a walkable approach; the passage row 9 through every partition; plants and shelves; places of neighbouring columns 6 cells apart", () => {
  const layout = buildLayout(19);
  assert.equal(MAP_19.length, 22);
  MAP_19.forEach((line, y) => {
    assert.equal(line.length, 35);
    for (let i = 0; i < line.length; i++) {
      assert.equal(
        cellKind(layout, 5 + i, y),
        MAP_KINDS[line[i]],
        `cell ${5 + i},${y} ('${line[i]}')`,
      );
    }
  });
  // the three rooms and their captions: the cells of the captions (design
  // 4.5, ROOM_LABEL_AT: 580,21 / 624,309 / 842,261 logical px)
  assert.deepEqual(Object.keys(ROOM_LABELS).sort(), [
    "kitchen",
    "meeting",
    "server",
  ]);
  for (const text of Object.values(ROOM_LABELS)) assert.ok(text.length > 0);
  const labelCells = {
    meeting: [Math.floor(580 / 24), Math.floor(21 / 24)],
    server: [Math.floor(624 / 24), Math.floor(309 / 24)],
    kitchen: [Math.floor(842 / 24), Math.floor(261 / 24)],
  };
  assert.deepEqual(labelCells, {
    meeting: [24, 0],
    server: [26, 12],
    kitchen: [35, 10],
  });
  for (const cell of Object.values(labelCells)) {
    assert.ok(layout.min_x <= cell[0] && cell[0] <= layout.max_x);
  }
  const count = (kind, lo = layout.min_x, hi = layout.max_x) => {
    let n = 0;
    for (let y = 0; y < layout.height; y++)
      for (let x = lo; x <= hi; x++) if (cellKind(layout, x, y) === kind) n++;
    return n;
  };
  assert.equal(count("board"), 16);
  assert.equal(count("table"), 24);
  assert.equal(count("counter"), 4);
  assert.equal(count("server"), 6);
  assert.equal(count("chair", 23, 39), 14);
  assert.ok(count("plant", 5, 22) >= 2 && count("shelf", 5, 22) >= 2);
  assert.ok(count("plant", 23, 39) >= 1 && count("shelf", 23, 39) >= 1);
  // the desks
  assert.equal(layout.desks.length, 19);
  const seen = new Set();
  for (const spot of layout.desks) {
    const key = spot.block.join(",");
    assert.equal(seen.has(key), false);
    seen.add(key);
    for (const [dx, dy] of [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ])
      assert.equal(
        cellKind(layout, spot.block[0] + dx, spot.block[1] + dy),
        "desk",
      );
    assert.equal(kindAt(layout, spot.seat), "seat");
    assert.ok(walkable(layout, spot.approach[0], spot.approach[1]));
  }
  assert.equal(seen.size, 19);
  // the passage: row 9 is walkable through every partition
  for (const p of layout.partitions) {
    assert.equal(cellKind(layout, p.x, 9), "floor");
    assert.ok(canStep(layout, p.x - 1, 9, p.x, 9));
    assert.ok(canStep(layout, p.x, 9, p.x + 1, 9));
    assert.equal(canStep(layout, p.x - 1, 8, p.x, 8), false);
  }
  assert.equal(layout.partitions.length, 2);
  // places of neighbouring columns of one row are 6 cells = 144 logical px
  // apart: wider than the widest caption (D13, LABEL_MAX_WIDTH 130)
  for (let d = 0; d + 1 < 19; d++) {
    const a = layout.desks[d];
    const b = layout.desks[d + 1];
    if (a.row !== b.row) continue;
    assert.equal((b.seat[0] - a.seat[0]) * 24, 144);
    assert.ok((b.seat[0] - a.seat[0]) * 24 > 130);
  }
});

test("LY-16: the mutual position against the constants before the change of 2026-10-06 - the approaches left of the rooms, the meeting room above the server room and the kitchen, the server room left of the kitchen; the desks of one column share one block x; the extra columns stay left", () => {
  // constants of the layout before the change of 2026-10-06 (40 x 34 cells)
  const BEFORE_2026_10_06 = {
    maxApproachX: 18,
    meetingRows: [1, 6],
    serverRows: [11, 15],
    serverX: [26, 28],
    kitchenX: [36, 37],
  };
  assert.ok(BEFORE_2026_10_06.maxApproachX < 23);
  const extent = (layout, kinds) => {
    const xs = [];
    const ys = [];
    for (let y = 0; y < layout.height; y++)
      for (let x = layout.min_x; x <= layout.max_x; x++)
        if (kinds.includes(cellKind(layout, x, y))) {
          xs.push(x);
          ys.push(y);
        }
    return {
      x: [Math.min(...xs), Math.max(...xs)],
      y: [Math.min(...ys), Math.max(...ys)],
    };
  };
  for (const d of [19, 22, 29, 36, 49]) {
    const layout = buildLayout(d);
    const ROOM_LEFT_X = 23;
    for (const spot of layout.desks) {
      assert.ok(
        spot.approach[0] < ROOM_LEFT_X,
        `${d}: approach ${spot.approach}`,
      );
      assert.ok(spot.seat[0] < ROOM_LEFT_X);
      assert.ok(spot.block[0] >= layout.min_x);
    }
    const meeting = extent(layout, ["tile", "table", "board"]);
    const server = extent(layout, ["server"]);
    const kitchen = extent(layout, ["counter"]);
    // the meeting room: its tiles lie in rows 1-6
    assert.deepEqual(meeting.y, BEFORE_2026_10_06.meetingRows, `${d}: meeting`);
    assert.ok(meeting.y[0] < server.y[0] && meeting.y[0] < kitchen.y[0]);
    assert.ok(meeting.y[1] < server.y[0] && meeting.y[1] < kitchen.y[0]);
    assert.ok(server.x[1] < kitchen.x[0]);
    assert.deepEqual(server.x, BEFORE_2026_10_06.serverX);
    assert.deepEqual(kitchen.x, BEFORE_2026_10_06.kitchenX);
    assert.ok(server.y[0] >= BEFORE_2026_10_06.serverRows[0]);
    assert.ok(server.y[1] <= BEFORE_2026_10_06.serverRows[1]);
    // the desks of one column stand on one x
    const byColumn = new Map();
    for (const spot of layout.desks) {
      if (!byColumn.has(spot.column)) byColumn.set(spot.column, new Set());
      byColumn.get(spot.column).add(spot.block[0]);
    }
    for (const [column, xs] of byColumn)
      assert.equal(xs.size, 1, `${d}: column ${column}`);
    if (d > 21) {
      for (const spot of layout.desks)
        if (spot.column < 0)
          assert.ok(spot.approach[0] < 5, `${d}: extra column`);
    }
  }
});

test("LY-17: the lower bound of the cell - MIN_CELL_PX is 27 and follows the formula; fitCanvas never gives less, a whole number, width = cols x cell; 35 x 22 fits every area from 972 x 594; the windows of the design give 28, 35, 41, 55 and 27", () => {
  const formula = Math.ceil(
    Math.max(
      (MIN_FIGURE_PX * 24) / (FIGURE_BOTTOM - FIGURE_TOP),
      (MIN_LABEL_PX * 24) / LABEL_FONT_UNITS,
    ),
  );
  assert.equal(MIN_CELL_PX, 27);
  assert.equal(formula, 27);
  assert.equal(MIN_CELL_PX, formula);
  assert.deepEqual(
    [FIGURE_TOP, FIGURE_BOTTOM, LABEL_FONT_UNITS, MIN_FIGURE_PX, MIN_LABEL_PX],
    [2, 20, 9, 20, 10],
  );
  // the figure and the caption at the lower bound (criterion 18(b))
  assert.ok(((FIGURE_BOTTOM - FIGURE_TOP) * MIN_CELL_PX) / 24 >= 20);
  assert.ok((LABEL_FONT_UNITS * MIN_CELL_PX) / 24 >= 10);
  assert.ok(((FIGURE_BOTTOM - FIGURE_TOP) * (MIN_CELL_PX - 1)) / 24 < 20);
  const sizes = [
    0,
    -5,
    Number.NaN,
    1,
    100,
    945,
    971,
    972,
    1022,
    1472,
    3169,
    Infinity,
  ];
  for (const layout of [buildLayout(19), buildLayout(40)]) {
    assert.deepEqual([layout.width, layout.height].length, 2);
    for (const w of sizes) {
      for (const h of sizes) {
        const got = fitCanvas(layout, { width: w, height: h });
        const where = `${layout.width}x${layout.height} in ${w}x${h}`;
        const good = Number.isFinite(w) && w > 0 && h > 0;
        const want = good
          ? Math.max(
              27,
              Math.floor(Math.min(w / layout.width, h / layout.height)),
            )
          : 27;
        assert.ok(Number.isInteger(got.cellPx), where);
        assert.ok(got.cellPx >= 27, where);
        assert.equal(got.cellPx, want, where);
        assert.equal(got.width, layout.width * got.cellPx, where);
        assert.equal(got.height, layout.height * got.cellPx, where);
        assert.equal(
          got.fits,
          good && got.width <= w && got.height <= h,
          where,
        );
        if (layout.width === 35 && Number.isFinite(w) && w >= 972 && h >= 594) {
          assert.equal(got.fits, true, where);
        }
      }
    }
  }
  // 52 x 22 (40 desks) in 1022 x 621 does not fit: 27 and a canvas of 1404 x 594
  const wide = buildLayout(40);
  assert.equal(wide.width, 52);
  assert.equal(wide.height, 22);
  const scrolled = fitCanvas(wide, { width: 1022, height: 621 });
  assert.deepEqual(
    [scrolled.cellPx, scrolled.width, scrolled.height, scrolled.fits],
    [27, 1404, 594, false],
  );
  // the windows of the design (4.15, 9): the root R, the area of #office-inner,
  // the place under the canvas = height - the legend band (2.4375 R) - the gap
  // (0.625 R)
  const area = (W, H) => {
    const R = Math.min(24, Math.max(16, Math.min(W / 120, H / 67.5)));
    return {
      R,
      width: W - 27.875 * R - 2,
      height: H - 7 * R - 2 - 0.625 * R - 2.4375 * R,
    };
  };
  const windows = [
    [1470, 784, 28, true],
    [1920, 950, 35, true],
    [1920, 1080, 41, true],
    [2560, 1440, 55, true],
    [480, 800, 27, false],
  ];
  const cellAt = {};
  for (const [W, H, cell, fits] of windows) {
    const a = area(W, H);
    const size = fitCanvas(buildLayout(19), {
      width: a.width,
      height: W < 600 ? Infinity : a.height,
    });
    assert.equal(size.cellPx, cell, `${W}x${H}`);
    assert.equal(size.fits, fits, `${W}x${H}`);
    assert.ok(size.cellPx >= 27);
    assert.ok(0.75 * size.cellPx >= 20, `${W}x${H}: the figure`);
    assert.ok(0.375 * size.cellPx >= 10, `${W}x${H}: the caption`);
    cellAt[W + "x" + H] = size.cellPx;
  }
  assert.ok(cellAt["1920x1080"] >= 26);
  assert.ok(cellAt["2560x1440"] >= cellAt["1920x1080"]);
  // the fallback of 40 desks (52 x 22)
  for (const [W, H, cell] of [
    [1470, 784, 27],
    [1920, 1080, 28],
    [2560, 1440, 37],
  ]) {
    const a = area(W, H);
    assert.equal(
      fitCanvas(wide, { width: a.width, height: a.height }).cellPx,
      cell,
      `40 desks in ${W}x${H}`,
    );
  }
});

test("LY-18: growth - buildLayout(D) for D from 0 to 49 follows the table of size; with 22-49 desks there are no dead rows and columns; the places 0..20 are the same at 21 and 49 desks", () => {
  for (let d = 0; d <= 49; d++) {
    const layout = buildLayout(d);
    const e = expectedSize(d);
    for (const key of Object.keys(e))
      assert.equal(layout[key], e[key], `${d}: ${key}`);
    assert.equal(layout.desks.length, d);
    assert.equal(layout.height, 22);
    if (d >= 22) {
      const dead = deadLines(layout);
      // by the definition of LY-14: no two empty ones side by side, none at
      // the outer wall; the single passage row 9 stays the only empty row
      assert.deepEqual(dead.bad, [], `${d}: dead rows or columns`);
      assert.deepEqual(dead.rows, [9], `${d}: empty rows`);
    }
  }
  assert.deepEqual(
    [21, 22, 28, 29, 35, 36, 42, 43, 49].map((d) => {
      const l = buildLayout(d);
      return [l.width, l.height];
    }),
    [
      [35, 22],
      [40, 22],
      [40, 22],
      [46, 22],
      [46, 22],
      [52, 22],
      [52, 22],
      [58, 22],
      [58, 22],
    ],
  );
  const at21 = buildLayout(21);
  const at49 = buildLayout(49);
  for (let d = 0; d < 21; d++) {
    assert.deepEqual(at21.desks[d], at49.desks[d], `place ${d}`);
    assert.deepEqual(at21.desks[d], { index: d, ...expectedSpot(d) });
  }
});
