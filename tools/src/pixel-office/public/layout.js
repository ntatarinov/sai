// The one grid of the office (design 3.9, 4.4): it is drawn from it and the
// routes are built on it, so a character cannot walk through a wall, a desk,
// furniture or a partition. Pure ES module: no DOM and no Node API.
//
// Coordinates are counted from the rooms: x is the column, y the row of an
// office of one bay (40 x 25 cells, as on the sample). The block of rooms
// always takes x 23-39, y 0-23. When the office grows to the left, the new
// cells get negative x (min_x is the left wall) and the old cells keep their
// coordinates, so the fixed layer and the places of the occupied desks are the
// same for any number of desks.

// Pixels of one cell on the canvas (before the canvas is scaled).
export const CELL = 24;
// A bay: 3 columns of desks by 4 rows, 18 x 16 cells.
export const BAY_DESKS = 12;
export const BAY_WIDTH = 18;
export const BAY_HEIGHT = 16;
// The block of rooms: x from ROOM_LEFT to RIGHT_WALL, y from 0 to ROOM_BOTTOM.
export const ROOM_LEFT = 23;
export const RIGHT_WALL = 39;
export const ROOM_BOTTOM = 23;

// The block of rooms, columns 23-39 of rows 0-23 (design 4.4). Signs: '#'
// wall, '.' floor, 'm' tile of the meeting room, 'T' big table, 'h' chair
// outside the desks, 'W' lower part of the board, 'K' kitchen counter, 'S'
// server rack, 'P' plant, 'B' shelf.
export const ROOM_MAP = Object.freeze([
  "#################",
  "#.mmmWWWWWWWWmBP#",
  "#.mmmWWWWWWWWmmm#",
  "#.mhmTTTTTTTTmhm#",
  "#.mhmTTTTTTTTmhm#",
  "#.mhmTTTTTTTTmhm#",
  "#.mmmhmhmhmhmmmm#",
  "#####....########",
  "................#",
  "................#",
  "................#",
  "#########..h.KK.#",
  "#.......#....KK.#",
  "#..SSS..#..h....#",
  "#..SSS..#.......#",
  "#.......#.......#",
  "#########......P#",
  "................#",
  "................#",
  "................#",
  ".......h.h......#",
  "................#",
  "................#",
  "................#",
]);

const ROOM_KINDS = Object.freeze({
  "#": "wall",
  ".": "floor",
  m: "tile",
  T: "table",
  h: "chair",
  W: "board",
  K: "counter",
  S: "server",
  P: "plant",
  B: "shelf",
});

// The furniture next to the desks: it does not move when the office grows.
export const DECOR = Object.freeze([
  Object.freeze({ x: 1, y: 1, kind: "plant" }),
  Object.freeze({ x: 2, y: 1, kind: "shelf" }),
  Object.freeze({ x: 3, y: 1, kind: "shelf" }),
  Object.freeze({ x: 1, y: 23, kind: "plant" }),
]);

// Every cell of the fixed layer: the block of rooms and the decor, [x, y].
export const FIXED_CELLS = Object.freeze([
  ...ROOM_MAP.flatMap((line, y) =>
    Array.from(line, (_sign, i) => Object.freeze([ROOM_LEFT + i, y])),
  ),
  ...DECOR.map((d) => Object.freeze([d.x, d.y])),
]);

export const WALKABLE_KINDS = new Set(["floor", "tile", "seat"]);

const KINDS = Object.freeze([
  "wall",
  "floor",
  "tile",
  "desk",
  "seat",
  "reserved",
  "table",
  "chair",
  "board",
  "counter",
  "server",
  "plant",
  "shelf",
]);
const CODE = new Map(KINDS.map((kind, i) => [kind, i]));
const FLOOR = CODE.get("floor");

function count(n) {
  return Number.isSafeInteger(n) && n >= 0 ? n : 0;
}

// The place of desk d (0 is the main session, 1, 2, ... the roles): bay
// floor(d / 12), place i = d mod 12, column i mod 3, row floor(i / 3). Null if
// d is not a whole number from 0. It depends only on d, so an occupied desk
// never moves when other desks appear.
export function deskSpot(d) {
  if (!Number.isSafeInteger(d) || d < 0) return null;
  const bay = Math.floor(d / BAY_DESKS);
  const i = d % BAY_DESKS;
  const column = i % 3;
  const row = Math.floor(i / 3);
  const X = 1 - BAY_WIDTH * Math.floor(bay / 2);
  const Y = 1 + BAY_HEIGHT * (bay % 2);
  return Object.freeze({
    index: d,
    bay,
    column,
    row,
    block: Object.freeze([X + 2 + 6 * column, Y + 1 + 4 * row]),
    seat: Object.freeze([X + 4 + 6 * column, Y + 2 + 4 * row]),
    approach: Object.freeze([X + 5 + 6 * column, Y + 2 + 4 * row]),
  });
}

// The size of the office for deskCount occupied desks. Bay 0 is always there.
export function officeSize(deskCount) {
  const desks = count(deskCount);
  const bays = Math.max(1, Math.ceil(desks / BAY_DESKS));
  const bayColumns = Math.ceil(bays / 2);
  const minX = -BAY_WIDTH * (bayColumns - 1);
  return Object.freeze({
    desk_count: desks,
    bays,
    bay_columns: bayColumns,
    min_x: minX,
    max_x: RIGHT_WALL,
    width: RIGHT_WALL - minX + 1,
    height: bays === 1 ? 25 : 34,
  });
}

// The partitions of the bays that have desks: a line on the left border of
// column X + 7 as soon as place 12b + 1 is taken, of column X + 13 as soon as
// place 12b + 2 is taken; rows Y ... Y + 15 except Y + 7 (the passage).
function partitionsOf(size) {
  const out = [];
  for (let bay = 0; bay < size.bays; bay++) {
    const X = 1 - BAY_WIDTH * Math.floor(bay / 2);
    const Y = 1 + BAY_HEIGHT * (bay % 2);
    for (const [offset, place] of [
      [7, 1],
      [13, 2],
    ]) {
      if (size.desk_count > BAY_DESKS * bay + place) {
        out.push(
          Object.freeze({
            bay,
            x: X + offset,
            top: Y,
            bottom: Y + BAY_HEIGHT - 1,
            gap: Y + 7,
          }),
        );
      }
    }
  }
  return out;
}

// The tables of a layout: the kind of every cell and, for every cell, whether
// its left border is closed by a partition. They are kept outside the frozen
// layout object (a typed array cannot be frozen) and built once.
const TABLES = new WeakMap();

function buildTables(layout) {
  const { min_x: minX, width, height, desk_count: desks } = layout;
  const kinds = new Uint8Array(width * height);
  const leftClosed = new Uint8Array(width * height);
  const at = (x, y) => y * width + (x - minX);
  const inside = (x, y) => x >= minX && x <= RIGHT_WALL && y >= 0 && y < height;
  // Rules 2, 3 and 6 of design 4.4; a cell they set is "fixed".
  const fixed = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = minX; x <= RIGHT_WALL; x++) {
      const i = at(x, y);
      if (x >= ROOM_LEFT && y <= ROOM_BOTTOM) {
        kinds[i] = CODE.get(ROOM_KINDS[ROOM_MAP[y][x - ROOM_LEFT]]);
        fixed[i] = 1;
      } else if (
        x === minX ||
        y === 0 ||
        y === height - 1 ||
        x === RIGHT_WALL
      ) {
        kinds[i] = CODE.get("wall");
        fixed[i] = 1;
      } else {
        kinds[i] = FLOOR;
      }
    }
  }
  for (const d of DECOR) {
    if (!inside(d.x, d.y)) continue;
    kinds[at(d.x, d.y)] = CODE.get(d.kind);
    fixed[at(d.x, d.y)] = 1;
  }
  // Rule 4: the blocks of every place of every bay that fits in the office
  // (two bays per column of bays): desk if occupied, else reserved.
  const places = 2 * layout.bay_columns * BAY_DESKS;
  for (let d = 0; d < places; d++) {
    const spot = deskSpot(d);
    const kind = CODE.get(d < desks ? "desk" : "reserved");
    for (let dy = 0; dy < 2; dy++) {
      for (let dx = 0; dx < 2; dx++) {
        const x = spot.block[0] + dx;
        const y = spot.block[1] + dy;
        if (inside(x, y) && fixed[at(x, y)] === 0) kinds[at(x, y)] = kind;
      }
    }
  }
  // Rule 5: the seats of the occupied desks.
  for (const spot of layout.desks) {
    const [x, y] = spot.seat;
    if (inside(x, y) && kinds[at(x, y)] === FLOOR) {
      kinds[at(x, y)] = CODE.get("seat");
    }
  }
  for (const p of layout.partitions) {
    for (let y = p.top; y <= p.bottom; y++) {
      if (y !== p.gap && inside(p.x, y)) leftClosed[at(p.x, y)] = 1;
    }
  }
  return { kinds, leftClosed, at };
}

function tablesOf(layout) {
  let tables = TABLES.get(layout);
  if (tables === undefined) {
    tables = buildTables(layout);
    TABLES.set(layout, tables);
  }
  return tables;
}

// The grid of an office with deskCount occupied desks. Frozen: a test that
// needs another walkability passes its own step function to findPath.
export function buildLayout(deskCount) {
  const size = officeSize(deskCount);
  const desks = [];
  for (let d = 0; d < size.desk_count; d++) desks.push(deskSpot(d));
  const layout = Object.freeze({
    ...size,
    desks: Object.freeze(desks),
    partitions: Object.freeze(partitionsOf(size)),
  });
  TABLES.set(layout, buildTables(layout));
  return layout;
}

function isInside(layout, x, y) {
  return (
    Number.isInteger(x) &&
    Number.isInteger(y) &&
    x >= layout.min_x &&
    x <= layout.max_x &&
    y >= 0 &&
    y < layout.height
  );
}

// The kind of a cell; "outside" for a cell out of the office or not whole.
export function cellKind(layout, x, y) {
  if (!isInside(layout, x, y)) return "outside";
  const { kinds, at } = tablesOf(layout);
  return KINDS[kinds[at(x, y)]];
}

export function walkable(layout, x, y) {
  return WALKABLE_KINDS.has(cellKind(layout, x, y));
}

// One step to a neighbour (four directions): the target cell is walkable and
// no partition line lies between the two cells.
export function canStep(layout, x, y, nx, ny) {
  if (![x, y, nx, ny].every(Number.isInteger)) return false;
  if (Math.abs(nx - x) + Math.abs(ny - y) !== 1) return false;
  if (!walkable(layout, nx, ny)) return false;
  if (ny === y) {
    const border = Math.max(x, nx);
    if (isInside(layout, border, y)) {
      const { leftClosed, at } = tablesOf(layout);
      if (leftClosed[at(border, y)] === 1) return false;
    }
  }
  return true;
}

// Right, left, down, up: a fixed order, so the shortest path is the same on
// every run (as findPath in the reference).
const STEPS = Object.freeze([
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
]);

// Breadth-first search; every step goes through `step`, so the path never
// crosses a cell that is not walkable or a partition. Returns the cells after
// `from` up to and including `to`; [] if they are the same; null if `to`
// cannot be reached or either cell is outside the office (then the caller
// leaves the character where it is).
export function findPath(layout, from, to, step = canStep) {
  if (!Array.isArray(from) || !Array.isArray(to)) return null;
  const [sx, sy] = from;
  const [tx, ty] = to;
  if (!isInside(layout, sx, sy) || !isInside(layout, tx, ty)) return null;
  if (sx === tx && sy === ty) return [];
  const width = layout.width;
  const minX = layout.min_x;
  const id = (x, y) => y * width + (x - minX);
  const previous = new Int32Array(width * layout.height).fill(-1);
  const start = id(sx, sy);
  previous[start] = start;
  let frontier = [[sx, sy]];
  while (frontier.length > 0) {
    const next = [];
    for (const [x, y] of frontier) {
      for (const [dx, dy] of STEPS) {
        const nx = x + dx;
        const ny = y + dy;
        if (!isInside(layout, nx, ny) || previous[id(nx, ny)] !== -1) continue;
        if (!step(layout, x, y, nx, ny)) continue;
        previous[id(nx, ny)] = id(x, y);
        if (nx === tx && ny === ty) {
          const path = [];
          let cell = id(nx, ny);
          while (cell !== start) {
            path.push([(cell % width) + minX, Math.floor(cell / width)]);
            cell = previous[cell];
          }
          return path.reverse();
        }
        next.push([nx, ny]);
      }
    }
    frontier = next;
  }
  return null;
}
