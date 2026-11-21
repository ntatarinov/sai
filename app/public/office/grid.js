// ported from tools/src/pixel-office/public/layout.js at b5df4a808243a1f669ad3697374c265c720a7c31
// sha256 f23b9fe29b24bf37df8781f995e9f4eb33e9e73de7836bd33d6d4d1dd9c58c5f; no import of tools/

// The grid of an office: the one map a scene is drawn from and its walks are built on, so a figure
// never walks through a wall, a desk, furniture or a partition. Pure: no page, no clock and no
// chance. The code is the original's, with types in comments for the strict check of the app; the
// one function added here is stageMap at the end, the map of the stage of the public pages.
//
// Coordinates: x is the column, y the row. The block of rooms always takes x 23-39, y 0-20; the desks
// stand left of it in three columns of seven places (35 x 22 cells for up to 21 desks). When the
// office grows to the left, the new columns get smaller x (min_x is the left wall) and the old cells
// keep their coordinates, so the fixed cells and the places of the taken desks stay the same for any
// number of desks.

/**
 * A cell [x, y].
 * @typedef {readonly number[]} Cell
 */

/**
 * The place of a desk: its number, its column (0, 1, 2 the main ones; -1, -2, … the extra ones), its
 * row, the top left cell of its 2 x 2 block, its seat and the cell from which it is approached.
 * @typedef {object} DeskSpot
 * @property {number} index
 * @property {number} column
 * @property {number} row
 * @property {Cell} block
 * @property {Cell} seat
 * @property {Cell} approach
 */

/**
 * The size of an office.
 * @typedef {object} OfficeSize
 * @property {number} desk_count
 * @property {number} extra_columns
 * @property {number} columns
 * @property {number} min_x
 * @property {number} max_x
 * @property {number} width
 * @property {number} height
 */

/**
 * A drawn partition between two columns, with its passage row.
 * @typedef {object} Partition
 * @property {number} x
 * @property {number} column
 * @property {number} top
 * @property {number} bottom
 * @property {number} gap
 */

/**
 * A grid: its size, the places of its taken desks and its drawn partitions.
 * @typedef {OfficeSize & { desks: readonly DeskSpot[], partitions: readonly Partition[] }} Layout
 */

/**
 * The kind code of every cell of a layout, and the index of a cell in it.
 * @typedef {{ kinds: Uint8Array, at: (x: number, y: number) => number }} Tables
 */

// The pixels of one cell on the canvas (before the canvas is scaled).
export const CELL = 24;
// The main columns of desks, and the places in a column.
export const MAIN_COLUMNS = 3;
export const COLUMN_ROWS = 7;
export const MAIN_PLACES = MAIN_COLUMNS * COLUMN_ROWS;
// The cells from one column to the next: the passage, the desk (2 cells), the seat, the approach and
// the cell of the partition.
export const COLUMN_PITCH = 6;
// The cells from one row to the next: the desk (2 rows) and the row of the passage.
export const ROW_PITCH = 3;
// The row of the passage through every partition.
export const GAP_ROW = 9;
// The rows of the office, both outer walls included (y 0-21).
export const OFFICE_HEIGHT = 22;
// The block of rooms: x from ROOM_LEFT to RIGHT_WALL, y from 0 to ROOM_BOTTOM.
export const ROOM_LEFT = 23;
export const RIGHT_WALL = 39;
export const ROOM_BOTTOM = 20;

// The block of rooms, columns 23-39 of rows 0-20. Signs: '#' wall, '.' floor, 'm' tile of the
// meeting room, 'T' big table, 'h' chair outside the desks, 'W' lower part of the board, 'K' kitchen
// counter, 'S' server rack, 'P' plant, 'B' shelf.
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
]);

/** @type {Readonly<Record<string, string>>} */
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

// The furniture next to the desks, on the cells of the passages at the upper and the lower wall: it
// does not move when the office grows.
export const DECOR = Object.freeze([
  Object.freeze({ x: 6, y: 1, kind: "plant" }),
  Object.freeze({ x: 12, y: 1, kind: "shelf" }),
  Object.freeze({ x: 18, y: 1, kind: "shelf" }),
  Object.freeze({ x: 6, y: 20, kind: "plant" }),
]);

// Every fixed cell: the block of rooms and the decor, [x, y].
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
  "partition",
  "table",
  "chair",
  "board",
  "counter",
  "server",
  "plant",
  "shelf",
]);
const CODE = new Map(KINDS.map((kind, i) => [kind, i]));
const FLOOR = /** @type {number} */ (CODE.get("floor"));

/**
 * A count of desks: a whole number from 0, anything else 0.
 * @param {number} n
 * @returns {number}
 */
function count(n) {
  return Number.isSafeInteger(n) && n >= 0 ? n : 0;
}

/**
 * The left edge of column j: 0, 1, 2 are the main columns, -1, -2, … the extra ones that grow to the
 * left.
 * @param {number} j
 * @returns {number}
 */
function columnX(j) {
  return 6 + COLUMN_PITCH * j;
}

/**
 * The extra columns for a number of desks: 7 places each, past the 21 places of the main columns.
 * @param {number} desks
 * @returns {number}
 */
function extraColumns(desks) {
  return Math.max(0, Math.ceil((desks - MAIN_PLACES) / COLUMN_ROWS));
}

/**
 * The place of desk d (0, 1, 2, …): below 21, column d mod 3 and row floor(d / 3); from 21 on, the
 * extra columns, filled from the top. Null if d is not a whole number from 0. It depends only on d,
 * so a taken desk never moves when other desks appear.
 * @param {number} d
 * @returns {DeskSpot | null}
 */
export function deskSpot(d) {
  if (!Number.isSafeInteger(d) || d < 0) return null;
  let column;
  let row;
  if (d < MAIN_PLACES) {
    column = d % MAIN_COLUMNS;
    row = Math.floor(d / MAIN_COLUMNS);
  } else {
    column = -1 - Math.floor((d - MAIN_PLACES) / COLUMN_ROWS);
    row = (d - MAIN_PLACES) % COLUMN_ROWS;
  }
  const X = columnX(column);
  return Object.freeze({
    index: d,
    column,
    row,
    block: Object.freeze([X + 1, 1 + ROW_PITCH * row]),
    seat: Object.freeze([X + 3, 2 + ROW_PITCH * row]),
    approach: Object.freeze([X + 4, 2 + ROW_PITCH * row]),
  });
}

/**
 * The size of the office for a number of taken desks. It never shrinks below the three main columns
 * (35 x 22). With extra columns, the passage cell of the leftmost one becomes the left wall.
 * @param {number} deskCount
 * @returns {OfficeSize}
 */
export function officeSize(deskCount) {
  const desks = count(deskCount);
  const extra = extraColumns(desks);
  const minX = extra === 0 ? columnX(0) - 1 : columnX(-extra);
  return Object.freeze({
    desk_count: desks,
    extra_columns: extra,
    columns: MAIN_COLUMNS + extra,
    min_x: minX,
    max_x: RIGHT_WALL,
    width: RIGHT_WALL - minX + 1,
    height: OFFICE_HEIGHT,
  });
}

/**
 * Whether column j has at least one taken desk: a main column from desk j on, an extra column always
 * (it appears with its first desk).
 * @param {OfficeSize} size
 * @param {number} j
 * @returns {boolean}
 */
function columnTaken(size, j) {
  return j >= 0 ? size.desk_count > j : -1 - j < size.extra_columns;
}

/**
 * The drawn partitions, by x: the cell X(j) + 5 between columns j and j + 1 carries a line when both
 * columns have a taken desk.
 * @param {OfficeSize} size
 * @returns {Partition[]}
 */
function partitionsOf(size) {
  const out = [];
  for (let j = -size.extra_columns; j <= MAIN_COLUMNS - 2; j++) {
    if (columnTaken(size, j) && columnTaken(size, j + 1)) {
      out.push(
        Object.freeze({
          x: columnX(j) + 5,
          column: j,
          top: 1,
          bottom: OFFICE_HEIGHT - 2,
          gap: GAP_ROW,
        }),
      );
    }
  }
  return out;
}

// The kind of every cell of a layout. It is kept outside the frozen layout object (a typed array
// cannot be frozen) and built once.
/** @type {WeakMap<object, Tables>} */
const TABLES = new WeakMap();

/**
 * The kinds of the cells of an office layout, by these rules in turn: the block of rooms by its map;
 * the outer walls; the partition cells, open at the passage row; the decor; the 2 x 2 blocks of every
 * place of every column (a desk where it is taken, else reserved, on a cell no earlier rule set); the
 * seats of the taken desks.
 * @param {Layout} layout
 * @returns {Tables}
 */
function buildTables(layout) {
  const { min_x: minX, width, height, desk_count: desks } = layout;
  const extra = layout.extra_columns;
  const kinds = new Uint8Array(width * height);
  const at = (/** @type {number} */ x, /** @type {number} */ y) =>
    y * width + (x - minX);
  const inside = (/** @type {number} */ x, /** @type {number} */ y) =>
    x >= minX && x <= RIGHT_WALL && y >= 0 && y < height;
  const partitionXs = new Set();
  for (let j = -extra; j <= MAIN_COLUMNS - 2; j++) {
    partitionXs.add(columnX(j) + 5);
  }
  // The rooms, the outer walls and the partitions; a cell they set is "fixed".
  const fixed = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = minX; x <= RIGHT_WALL; x++) {
      const i = at(x, y);
      fixed[i] = 1;
      if (x >= ROOM_LEFT && y <= ROOM_BOTTOM) {
        kinds[i] = /** @type {number} */ (
          CODE.get(ROOM_KINDS[ROOM_MAP[y][x - ROOM_LEFT]])
        );
      } else if (
        x === minX ||
        y === 0 ||
        y === height - 1 ||
        x === RIGHT_WALL
      ) {
        kinds[i] = /** @type {number} */ (CODE.get("wall"));
      } else if (partitionXs.has(x)) {
        kinds[i] =
          y === GAP_ROW ? FLOOR : /** @type {number} */ (CODE.get("partition"));
      } else {
        kinds[i] = FLOOR;
        fixed[i] = 0;
      }
    }
  }
  for (const d of DECOR) {
    if (!inside(d.x, d.y)) continue;
    kinds[at(d.x, d.y)] = /** @type {number} */ (CODE.get(d.kind));
    fixed[at(d.x, d.y)] = 1;
  }
  // The blocks of every place of every column of the office: a desk if taken, else reserved.
  const places = MAIN_PLACES + COLUMN_ROWS * extra;
  for (let d = 0; d < places; d++) {
    const spot = /** @type {DeskSpot} */ (deskSpot(d));
    const kind = /** @type {number} */ (
      CODE.get(d < desks ? "desk" : "reserved")
    );
    for (let dy = 0; dy < 2; dy++) {
      for (let dx = 0; dx < 2; dx++) {
        const x = spot.block[0] + dx;
        const y = spot.block[1] + dy;
        if (inside(x, y) && fixed[at(x, y)] === 0) kinds[at(x, y)] = kind;
      }
    }
  }
  // The seats of the taken desks.
  for (const spot of layout.desks) {
    const [x, y] = spot.seat;
    if (inside(x, y) && kinds[at(x, y)] === FLOOR) {
      kinds[at(x, y)] = /** @type {number} */ (CODE.get("seat"));
    }
  }
  return { kinds, at };
}

/**
 * The tables of a layout, built on the first ask.
 * @param {Layout} layout
 * @returns {Tables}
 */
function tablesOf(layout) {
  let tables = TABLES.get(layout);
  if (tables === undefined) {
    tables = buildTables(layout);
    TABLES.set(layout, tables);
  }
  return tables;
}

/**
 * The grid of an office with a number of taken desks. Frozen: a caller that needs another walkability
 * gives findPath its own step function.
 * @param {number} deskCount
 * @returns {Layout}
 */
export function buildLayout(deskCount) {
  const size = officeSize(deskCount);
  const desks = [];
  for (let d = 0; d < size.desk_count; d++)
    desks.push(/** @type {DeskSpot} */ (deskSpot(d)));
  const layout = Object.freeze({
    ...size,
    desks: Object.freeze(desks),
    partitions: Object.freeze(partitionsOf(size)),
  });
  TABLES.set(layout, buildTables(layout));
  return layout;
}

/**
 * Whether a cell lies in the layout: whole coordinates within its edges.
 * @param {Layout} layout
 * @param {number} x
 * @param {number} y
 * @returns {boolean}
 */
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

/**
 * The kind of a cell; "outside" for a cell out of the layout or not whole.
 * @param {Layout} layout
 * @param {number} x
 * @param {number} y
 * @returns {string}
 */
export function cellKind(layout, x, y) {
  if (!isInside(layout, x, y)) return "outside";
  const { kinds, at } = tablesOf(layout);
  return KINDS[kinds[at(x, y)]];
}

/**
 * Whether a figure may stand on a cell: floor, tile or seat.
 * @param {Layout} layout
 * @param {number} x
 * @param {number} y
 * @returns {boolean}
 */
export function walkable(layout, x, y) {
  return WALKABLE_KINDS.has(cellKind(layout, x, y));
}

/**
 * One step to a neighbour (four directions): the target cell is walkable. A partition is a cell that
 * is never walkable, so no step crosses it.
 * @param {Layout} layout
 * @param {number} x
 * @param {number} y
 * @param {number} nx
 * @param {number} ny
 * @returns {boolean}
 */
export function canStep(layout, x, y, nx, ny) {
  if (![x, y, nx, ny].every(Number.isInteger)) return false;
  if (Math.abs(nx - x) + Math.abs(ny - y) !== 1) return false;
  return walkable(layout, nx, ny);
}

// Right, left, down, up: a fixed order, so the shortest path is the same on every run.
const STEPS = Object.freeze([
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
]);

/**
 * A breadth-first search; every step goes through `step`, so the path never crosses a cell that is
 * not walkable (a partition is one). Returns the cells after `from` up to and including `to`; [] if
 * they are the same; null if `to` cannot be reached or either cell is outside the layout (then the
 * caller leaves the figure where it is).
 * @param {Layout} layout
 * @param {unknown} from the cell [x, y] the path starts at
 * @param {unknown} to the cell [x, y] the path ends at
 * @param {(layout: Layout, x: number, y: number, nx: number, ny: number) => boolean} [step]
 * @returns {number[][] | null}
 */
export function findPath(layout, from, to, step = canStep) {
  if (!Array.isArray(from) || !Array.isArray(to)) return null;
  const [sx, sy] = from;
  const [tx, ty] = to;
  if (!isInside(layout, sx, sy) || !isInside(layout, tx, ty)) return null;
  if (sx === tx && sy === ty) return [];
  const width = layout.width;
  const minX = layout.min_x;
  const id = (/** @type {number} */ x, /** @type {number} */ y) =>
    y * width + (x - minX);
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

/**
 * The map of the stage of the public pages, added by the port: one row of `width` cells, every one
 * floor, along which a figure walks straight. A frozen object of the shape of a layout (min_x 0,
 * max_x width - 1, height 1, no desk, no column, no partition), registered in the table store, so
 * cellKind, walkable, canStep and findPath read it as they read a layout. Null unless width is a
 * whole number from 1 to 2000.
 * @param {unknown} width
 * @returns {Layout | null}
 */
export function stageMap(width) {
  if (
    typeof width !== "number" ||
    !Number.isInteger(width) ||
    width < 1 ||
    width > 2000
  )
    return null;
  const map = Object.freeze({
    desk_count: 0,
    extra_columns: 0,
    columns: 0,
    min_x: 0,
    max_x: width - 1,
    width,
    height: 1,
    desks: Object.freeze([]),
    partitions: Object.freeze([]),
  });
  TABLES.set(map, {
    kinds: new Uint8Array(width).fill(FLOOR),
    at: (x, y) => y * width + x,
  });
  return map;
}
