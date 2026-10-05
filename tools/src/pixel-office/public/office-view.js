// The size of the canvas, the drawing of the office and the hit test of a
// click (design 4.5, 4.13). It works only with the context and the canvas it
// is given and reads the same grid as the routes (layout.js), so what is drawn
// is what the characters walk on. Everything is drawn in logical pixels of the
// canvas: cell (x, y) starts at (x * 24, y * 24), after a transform that moves
// the left wall to the edge and scales the cell to a whole number of pixels
// (not smaller than MIN_CELL_PX, design 4.15, 5).

import { CELL, cellKind } from "./layout.js";
import { ROLE_PALETTE } from "./office-model.js";
import { ROOM_LABELS } from "./texts.js";

// The figure of a character spans the logical rows FIGURE_TOP..FIGURE_BOTTOM
// of its cell (hair from y + 2, body down to y + 9 + 11); the caption font is
// LABEL_FONT_UNITS logical px. On the screen the figure must be at least
// MIN_FIGURE_PX and the caption at least MIN_LABEL_PX CSS px (criterion 18(b)).
export const FIGURE_TOP = 2;
export const FIGURE_BOTTOM = 20;
export const LABEL_FONT_UNITS = 9;
export const MIN_FIGURE_PX = 20;
export const MIN_LABEL_PX = 10;
// The smallest cell on the screen, in pixels: 27.
export const MIN_CELL_PX = Math.ceil(
  Math.max(
    (MIN_FIGURE_PX * CELL) / (FIGURE_BOTTOM - FIGURE_TOP),
    (MIN_LABEL_PX * CELL) / LABEL_FONT_UNITS,
  ),
);
export const LABEL_FONT = "9px system-ui";
// Narrower than the distance between two seats of a row (144 px), so the
// captions of neighbours do not overlap.
export const LABEL_MAX_WIDTH = 130;
// The plate under a caption that touches a wall or a drawn partition line
// (design 4.5, step 8): the text box is LABEL_ASCENT above and LABEL_DESCENT
// below the base line, the plate is LABEL_PLATE_PAD wider on each side.
export const LABEL_ASCENT = 8;
export const LABEL_DESCENT = 3;
export const LABEL_PLATE_PAD = 2;
export const LABEL_PLATE_COLOR = "rgba(15, 21, 32, 0.85)";

// The colour of the base of a cell by its kind: walls, tiles, and the floor
// for everything else (floor and whatever stands on it), as a checkerboard.
export const BASE_COLORS = Object.freeze({
  wall: "#26344a",
  tile: "#1b2a3d",
  floor_even: "#131b27",
  floor_odd: "#151e2b",
});

const WALL_STRIPE = "#2f3f59";
const TILE_INSET = "#2a3e57";
const WOOD_EDGE = "#1a2433";
const WOOD = "#6b4f37";
const WOOD_LIGHT = "#805e42";
const CHAIR = "#3c4b6a";
const CHAIR_TOP = "#4d5a76";
const SKIN = "#f0d0b0";
const HAIR = "#3a2c22";
const SHADOW = "rgba(0, 0, 0, 0.35)";
const SCREEN_OFF = "#111d2e";
const LAPTOP_BASE = "#0d1420";
const LABEL_COLOR = "#93a7c4";
const SELECT_COLOR = "#5aa9ff";
const BADGE_WORK = "#48c98a";
const BADGE_SESSIONS = "#b48ce8";
const DARK_TEXT = "#07101c";
const ROOM_LABEL_COLOR = "#6b83a3";
const BUBBLE_FILL = "rgba(22, 31, 46, 0.96)";
const BUBBLE_TEXT = "#dbe4f0";
// The widest text of a bubble (description 3.9: 125 px, with the paddings
// 139 px).
const BUBBLE_TEXT_MAX = 125;

// The board on the wall of the meeting room (design 4.5, step 2).
const BOARD = Object.freeze({
  frame: [672, 6, 192, 60],
  back: [674, 8, 188, 56],
  left: 676,
  step: 43,
  top: 10,
  width: 39,
  height: 52,
  plaques: Object.freeze([
    ["in_progress", 2, "#e8b64c"],
    ["completed", 14, "#48c98a"],
    ["unrecorded", 26, "#ef6b5e"],
  ]),
  more: [854, 40],
});

// "ПЕРЕГОВОРНАЯ" starts 4 px right of the wall of the meeting room (x = 576),
// so that its end does not reach the frame of the board (x = 672).
const ROOM_LABEL_AT = Object.freeze([
  ["meeting", 580, 21],
  ["server", 624, 309],
  ["kitchen", 842, 261],
]);

function mod(a, b) {
  return ((a % b) + b) % b;
}

// The largest whole number of pixels per cell at which the office fits the
// area, but not less than MIN_CELL_PX. An area that is zero or not a number
// gives MIN_CELL_PX and fits = false; an infinite height means "as wide as the
// panel". A canvas that does not fit scrolls inside #office-scroll.
export function fitCanvas(layout, area) {
  const cols = layout.width;
  const rows = layout.height;
  const width = area === null || area === undefined ? NaN : area.width;
  const height = area === null || area === undefined ? NaN : area.height;
  const good = Number.isFinite(width) && width > 0 && height > 0;
  let cellPx = MIN_CELL_PX;
  if (good) {
    cellPx = Math.max(
      MIN_CELL_PX,
      Math.floor(Math.min(width / cols, height / rows)),
    );
  }
  const w = cols * cellPx;
  const h = rows * cellPx;
  return {
    cellPx,
    width: w,
    height: h,
    fits: good && w <= width && h <= height,
  };
}

// Strict overlap of [a1, a2] x [b1, b2] and [c1, c2] x [d1, d2]: touching by
// an edge is not an overlap.
function overlaps(a1, a2, b1, b2, c1, c2, d1, d2) {
  return a1 < c2 && c1 < a2 && b1 < d2 && d1 < b2;
}

// The plate under the caption of a character standing at (X, Y) (logical px)
// whose text is w px wide, or null: a plate is drawn only when the box of the
// caption overlaps a wall cell or a drawn partition line (design 4.5, step 8).
export function labelPlate(layout, X, Y, w) {
  if (!Number.isFinite(w) || w <= 0) return null;
  const cx = X + 12;
  const b = Y + 31;
  const l = cx - w / 2;
  const r = cx + w / 2;
  const t = b - LABEL_ASCENT;
  const u = b + LABEL_DESCENT;
  let touches = false;
  for (
    let y = Math.floor(t / CELL);
    !touches && y <= Math.ceil(u / CELL) - 1;
    y++
  ) {
    for (let x = Math.floor(l / CELL); x <= Math.ceil(r / CELL) - 1; x++) {
      if (cellKind(layout, x, y) === "wall") {
        touches = true;
        break;
      }
    }
  }
  for (const p of layout.partitions) {
    if (touches) break;
    const px1 = CELL * p.x + 11;
    const px2 = CELL * p.x + 13;
    touches =
      overlaps(l, r, t, u, px1, px2, CELL * p.top, CELL * p.gap) ||
      overlaps(l, r, t, u, px1, px2, CELL * (p.gap + 1), CELL * (p.bottom + 1));
  }
  if (!touches) return null;
  return {
    x: l - LABEL_PLATE_PAD,
    y: t,
    w: w + 2 * LABEL_PLATE_PAD,
    h: LABEL_ASCENT + LABEL_DESCENT,
  };
}

function rect(ctx, color, x, y, w, h) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function drawChair(ctx, x, y) {
  rect(ctx, CHAIR, x + 4, y + 6, 16, 18);
  rect(ctx, CHAIR_TOP, x + 4, y + 6, 16, 3);
}

function drawWoodBlock(ctx, x, y, w, h) {
  rect(ctx, WOOD_EDGE, x, y, w, h);
  rect(ctx, WOOD, x + 1, y + 1, w - 2, h - 2);
  rect(ctx, WOOD_LIGHT, x + 1, y + 1, w - 2, 3);
}

function drawDetail(ctx, kind, x, y) {
  if (kind === "wall") {
    rect(ctx, WALL_STRIPE, x, y, 24, 3);
  } else if (kind === "tile") {
    rect(ctx, TILE_INSET, x + 1, y + 1, 22, 22);
  } else if (kind === "chair") {
    drawChair(ctx, x, y);
  } else if (kind === "server") {
    rect(ctx, "#23334a", x + 3, y + 2, 18, 20);
    rect(ctx, "#48c98a", x + 5, y + 5, 3, 2);
    rect(ctx, "#e8b64c", x + 5, y + 10, 3, 2);
  } else if (kind === "plant") {
    rect(ctx, "#6b4e34", x + 8, y + 17, 8, 5);
    rect(ctx, "#2e9a55", x + 6, y + 3, 12, 14);
    rect(ctx, "#41a15f", x + 9, y + 5, 5, 5);
  } else if (kind === "shelf") {
    rect(ctx, WOOD, x + 1, y, 22, 13);
    rect(ctx, WOOD_LIGHT, x + 1, y, 22, 2);
    for (const sx of [4, 10, 16]) rect(ctx, "#9c7a55", x + sx, y + 3, 3, 8);
  }
}

// Step 1: every cell of the office, then the furniture, then the partition
// lines (2 px in the middle of the partition cell, broken at the passage).
// It depends only on the grid: never on the journal or the clock.
export function drawStatic(ctx, layout) {
  for (let y = 0; y < layout.height; y++) {
    for (let x = layout.min_x; x <= layout.max_x; x++) {
      const kind = cellKind(layout, x, y);
      let color = BASE_COLORS.wall;
      if (kind === "tile") color = BASE_COLORS.tile;
      else if (kind !== "wall") {
        color =
          mod(x + y, 2) === 0 ? BASE_COLORS.floor_even : BASE_COLORS.floor_odd;
      }
      rect(ctx, color, x * CELL, y * CELL, CELL, CELL);
    }
  }
  for (let y = 0; y < layout.height; y++) {
    for (let x = layout.min_x; x <= layout.max_x; x++) {
      drawDetail(ctx, cellKind(layout, x, y), x * CELL, y * CELL);
    }
  }
  // The desks of the occupied places, the big table and the kitchen counter.
  for (const spot of layout.desks) {
    drawWoodBlock(ctx, spot.block[0] * CELL, spot.block[1] * CELL, 48, 48);
  }
  drawWoodBlock(ctx, 28 * CELL, 3 * CELL, 192, 72);
  const kx = 36 * CELL;
  const ky = 11 * CELL;
  rect(ctx, WOOD_EDGE, kx, ky, 48, 48);
  rect(ctx, "#4a3a2c", kx + 1, ky + 1, 46, 46);
  rect(ctx, "#c98f5a", kx + 1, ky + 1, 46, 4);
  rect(ctx, "#161b28", kx + 4, ky + 8, 8, 12);
  rect(ctx, "#c8ccd4", kx + 7, ky + 16, 2, 2);
  rect(ctx, "#eef2f6", kx + 30, ky + 9, 4, 4);
  rect(ctx, "#eef2f6", kx + 36, ky + 9, 4, 4);
  for (const p of layout.partitions) {
    rect(
      ctx,
      WALL_STRIPE,
      p.x * CELL + 11,
      p.top * CELL,
      2,
      (p.gap - p.top) * CELL,
    );
    rect(
      ctx,
      WALL_STRIPE,
      p.x * CELL + 11,
      (p.gap + 1) * CELL,
      2,
      (p.bottom - p.gap) * CELL,
    );
  }
}

function countText(n, max) {
  return n > max ? `${max}+` : String(n);
}

function drawBoard(ctx, board) {
  rect(ctx, "#aebed7", ...BOARD.frame);
  rect(ctx, "#dde4f0", ...BOARD.back);
  ctx.textAlign = "center";
  board.columns.forEach((column, i) => {
    const x = BOARD.left + BOARD.step * i;
    const y = BOARD.top;
    rect(ctx, ROLE_PALETTE[column.color], x, y, BOARD.width, BOARD.height);
    ctx.font = "bold 8px system-ui";
    for (const [state, dy, color] of BOARD.plaques) {
      rect(ctx, "#0f1520", x + 1, y + dy - 1, 37, 12);
      rect(ctx, color, x + 2, y + dy, 35, 10);
      ctx.fillStyle = DARK_TEXT;
      ctx.fillText(countText(column.counts[state], 999), x + 19.5, y + dy + 8);
    }
    rect(ctx, "rgba(7, 16, 28, 0.75)", x, y + 38, 39, 14);
    ctx.font = "bold 7px system-ui";
    ctx.fillStyle = "#f2f6fb";
    ctx.fillText(column.label, x + 19.5, 58, 37);
  });
  if (board.more > 0) {
    ctx.font = "bold 8px system-ui";
    ctx.fillStyle = "#5b6b85";
    ctx.fillText(`+${board.more}`, ...BOARD.more);
  }
}

function drawFigure(ctx, color, x, y, walking, selected) {
  if (walking) rect(ctx, SHADOW, x + 5, y + 20, 14, 3);
  rect(ctx, color, x + 6, y + 9, 12, 11);
  rect(ctx, SKIN, x + 8, y + 2, 8, 8);
  rect(ctx, HAIR, x + 8, y + 2, 8, 3);
  if (selected) {
    rect(ctx, SELECT_COLOR, x + 3, y + 1, 18, 2);
    rect(ctx, SELECT_COLOR, x + 3, y + 20, 18, 2);
    rect(ctx, SELECT_COLOR, x + 3, y + 1, 2, 21);
    rect(ctx, SELECT_COLOR, x + 19, y + 1, 2, 21);
  }
}

function drawBadge(ctx, x, y, count, color) {
  rect(ctx, color, x, y, 10, 10);
  ctx.font = "bold 8px system-ui";
  ctx.textAlign = "center";
  ctx.fillStyle = DARK_TEXT;
  ctx.fillText(countText(count, 9), x + 5, y + 8);
}

// Draws the whole frame and returns the number of characters drawn.
// frame = {positions, selectedKey, bubbles, cellPx}: positions from
// Sim.positions(), bubbles from bubblesAt (a Map key -> bubble).
export function drawOffice(ctx, office, frame) {
  const layout = office.layout;
  const cellPx =
    Number.isFinite(frame.cellPx) && frame.cellPx > 0 ? frame.cellPx : CELL;
  const k = cellPx / CELL;
  ctx.setTransform(k, 0, 0, k, -layout.min_x * CELL * k, 0);

  // 1. The grid, 2. the board, 3. the captions of the rooms.
  drawStatic(ctx, layout);
  drawBoard(ctx, office.board);
  ctx.font = "9px system-ui";
  ctx.textAlign = "left";
  ctx.fillStyle = ROOM_LABEL_COLOR;
  for (const [name, x, y] of ROOM_LABEL_AT)
    ctx.fillText(ROOM_LABELS[name], x, y);

  const byKey = new Map(office.characters.map((c) => [c.key, c]));
  // 4. Laptops: the screen is lit in the colour of the role while the
  // character of the desk works. 5. The chairs of the places.
  for (const c of office.characters) {
    const spot = layout.desks[c.desk_index];
    if (spot === undefined) continue;
    const bx = spot.block[0] * CELL;
    const by = spot.block[1] * CELL;
    rect(
      ctx,
      c.working ? ROLE_PALETTE[c.color] : SCREEN_OFF,
      bx + 23,
      by + 5,
      16,
      11,
    );
    rect(ctx, LAPTOP_BASE, bx + 21, by + 16, 20, 3);
  }
  for (const c of office.characters) {
    const spot = layout.desks[c.desk_index];
    if (spot !== undefined)
      drawChair(ctx, spot.seat[0] * CELL, spot.seat[1] * CELL);
  }

  // 6. Seated, then 7. walking characters.
  const drawn = [];
  for (const p of frame.positions) {
    const character = byKey.get(p.key);
    if (character === undefined) continue;
    drawn.push({
      p,
      character,
      x: Math.round(p.x * CELL),
      y: Math.round(p.y * CELL),
      walking: p.state === "walking",
    });
  }
  for (const walking of [false, true]) {
    for (const d of drawn) {
      if (d.walking !== walking) continue;
      drawFigure(
        ctx,
        ROLE_PALETTE[d.character.color],
        d.x,
        d.y,
        walking,
        d.p.key === frame.selectedKey,
      );
    }
  }

  // 8. Captions, each on a plate if it touches a wall or a partition line;
  // 9. badges.
  ctx.font = LABEL_FONT;
  ctx.textAlign = "center";
  for (const d of drawn) {
    const label = d.character.label;
    const w = Math.min(ctx.measureText(label).width, LABEL_MAX_WIDTH);
    const plate = labelPlate(layout, d.x, d.y, w);
    if (plate !== null) {
      rect(ctx, LABEL_PLATE_COLOR, plate.x, plate.y, plate.w, plate.h);
    }
    ctx.fillStyle = LABEL_COLOR;
    ctx.fillText(label, d.x + 12, d.y + 31, LABEL_MAX_WIDTH);
  }
  for (const d of drawn) {
    if (d.character.working_count > 1) {
      drawBadge(ctx, d.x + 15, d.y, d.character.working_count, BADGE_WORK);
    }
    if (d.character.sessions_running > 1) {
      drawBadge(
        ctx,
        d.x - 1,
        d.y,
        d.character.sessions_running,
        BADGE_SESSIONS,
      );
    }
  }

  // 10. Bubbles, the later event on top; moved inside the canvas.
  const bubbles = frame.bubbles instanceof Map ? [...frame.bubbles] : [];
  bubbles.sort((a, b) => a[1].event_index - b[1].event_index);
  const where = new Map(drawn.map((d) => [d.p.key, d]));
  ctx.font = "10px system-ui";
  ctx.textAlign = "left";
  ctx.lineWidth = 1;
  for (const [key, bubble] of bubbles) {
    const d = where.get(key);
    if (d === undefined) continue;
    // Not wider than the description counts (139 px, less than the step of
    // the places, 144 px): a wider text is narrowed by fillText.
    const textWidth = ctx.measureText(bubble.text).width;
    const w = Math.min(textWidth, BUBBLE_TEXT_MAX) + 14;
    let bx = d.x + 12 - w / 2;
    bx = Math.min(bx, (layout.max_x + 1) * CELL - 2 - w);
    bx = Math.max(bx, layout.min_x * CELL + 2);
    const by = Math.max(d.y - 24, 2);
    ctx.beginPath();
    ctx.roundRect(bx, by, w, 18, 4);
    ctx.fillStyle = BUBBLE_FILL;
    ctx.fill();
    ctx.strokeStyle = ROLE_PALETTE[d.character.color];
    ctx.stroke();
    ctx.fillStyle = BUBBLE_TEXT;
    if (textWidth > BUBBLE_TEXT_MAX)
      ctx.fillText(bubble.text, bx + 7, by + 12, BUBBLE_TEXT_MAX);
    else ctx.fillText(bubble.text, bx + 7, by + 12);
  }
  return drawn.length;
}

// A click as a point in logical pixels of the canvas (office coordinates).
// A canvas without a size on the screen gives NaN: a miss of everyone.
export function canvasPoint(event, canvas, layout, cellPx) {
  const box = canvas.getBoundingClientRect();
  if (!(box.width > 0) || !(box.height > 0)) return { px: NaN, py: NaN };
  const k = cellPx / CELL;
  return {
    px:
      ((event.clientX - box.left) * canvas.width) / box.width / k +
      layout.min_x * CELL,
    py: ((event.clientY - box.top) * canvas.height) / box.height / k,
  };
}

// The character under a point or null. A character is hit if the point is
// closer than 0.9 cell horizontally and 1.1 cell vertically to the centre of
// its cell. Of several the nearest wins (Euclid); on a tie the one with the
// smaller desk.
export function hitTest(positions, px, py) {
  let best = null;
  let bestDistance = Infinity;
  let bestDesk = Infinity;
  positions.forEach((p, order) => {
    const cx = (p.x + 0.5) * CELL;
    const cy = (p.y + 0.5) * CELL;
    if (!(Math.abs(px - cx) < 0.9 * CELL && Math.abs(py - cy) < 1.1 * CELL)) {
      return;
    }
    const distance = Math.hypot(px - cx, py - cy);
    const desk = typeof p.desk_index === "number" ? p.desk_index : order;
    const nearer = distance < bestDistance - 1e-9;
    const tie = Math.abs(distance - bestDistance) <= 1e-9 && desk < bestDesk;
    if (nearer || tie) {
      best = p.key;
      bestDistance = distance;
      bestDesk = desk;
    }
  });
  return best;
}
