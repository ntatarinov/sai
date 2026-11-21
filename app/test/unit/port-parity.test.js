import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import { APP, ROOT } from "../fixtures/helpers.js";

// REQ-112 criteria 1 and 2: the two ports of the owner's office (app/public/office/grid.js and sim.js),
// their headers, and their parity with the two originals. The test imports the originals and the ports and
// drives both with the same calls. The originals stay as they are (never changed here); the oracle of «the
// original changed» is the recorded sha256 of the header, computed from the file with no git command.

const OFFICE = path.join(APP, "public", "office");
const PORTS = [
  {
    port: "grid.js",
    original: "tools/src/pixel-office/public/layout.js",
  },
  {
    port: "sim.js",
    original: "tools/src/pixel-office/public/office-sim.js",
  },
];
const sha256 = (/** @type {Buffer | string} */ bytes) =>
  createHash("sha256").update(bytes).digest("hex");
const importFile = (/** @type {string} */ file) =>
  import(pathToFileURL(file).href);

// The words that a planted copy must not hold in a literal (AP-093): the route kind of the original.
const OLD_KIND = ["hand", "off"].join("");

/**
 * The findings of one port against its original: the first comment of the port is exactly two lines,
 * `// ported from <path> at <40 hex>` and `// sha256 <64 hex>; no import of tools/`, then no comment line
 * follows at once; the path is the original's; and the sha256 of the original's bytes equals the one of the
 * header.
 * @param {string} portText
 * @param {Buffer} originalBytes
 * @param {string} originalRel
 * @returns {string[]}
 */
function headerFindings(portText, originalBytes, originalRel) {
  /** @type {string[]} */
  const out = [];
  const lines = portText.split("\n");
  const first = /^\/\/ ported from (\S+) at ([0-9a-f]{40})$/.exec(lines[0]);
  if (first === null)
    out.push("line 1 is not «ported from <path> at <40 hex>»");
  else if (first[1] !== originalRel)
    out.push(`line 1 names ${first[1]}, not ${originalRel}`);
  const second = /^\/\/ sha256 ([0-9a-f]{64}); no import of tools\/$/.exec(
    lines[1] ?? "",
  );
  if (second === null)
    out.push("line 2 is not «sha256 <64 hex>; no import of tools/»");
  if ((lines[2] ?? "").startsWith("//"))
    out.push("the first comment is longer than two lines");
  if (second !== null && second[1] !== sha256(originalBytes))
    out.push("the sha256 of the original is not the one of the header");
  return out;
}

test("PO-1 the two headers name their original, a commit and the sha256 of the original's bytes; a changed digit and a changed byte are red", () => {
  for (const { port, original } of PORTS) {
    const text = fs.readFileSync(path.join(OFFICE, port), "utf8");
    const bytes = fs.readFileSync(path.join(ROOT, original));
    assert.deepEqual(headerFindings(text, bytes, original), [], port);
    // The header holds what the original's sha256 is, and nothing in the file says «git».
    const header = /sha256 ([0-9a-f]{64})/.exec(text);
    assert.ok(header, port);
    assert.equal(header[1], sha256(bytes), port);

    // One hex digit of the hash of the header changed: red in the same comparison.
    const at = text.indexOf(header[1]);
    for (const k of [0, 31, 63]) {
      const digit = text[at + k];
      const other = digit === "0" ? "1" : "0";
      const damaged = `${text.slice(0, at + k)}${other}${text.slice(at + k + 1)}`;
      assert.notDeepEqual(
        headerFindings(damaged, bytes, original),
        [],
        `${port}: digit ${k}`,
      );
    }
    // A copy of the original with one byte changed, given to the same comparison: red.
    for (const k of [0, Math.floor(bytes.length / 2), bytes.length - 1]) {
      const copy = Buffer.from(bytes);
      copy[k] = copy[k] ^ 1;
      assert.notDeepEqual(
        headerFindings(text, copy, original),
        [],
        `${port}: byte ${k}`,
      );
    }
    // A byte added or removed at the end, and an empty original: red.
    assert.notDeepEqual(
      headerFindings(text, Buffer.concat([bytes, Buffer.from("\n")]), original),
      [],
    );
    assert.notDeepEqual(
      headerFindings(text, bytes.subarray(0, bytes.length - 1), original),
      [],
    );
    assert.notDeepEqual(headerFindings(text, Buffer.alloc(0), original), []);
    // Other damaged headers: a short commit, a wrong path, the words «no import of tools/» missing, a
    // third comment line.
    const lines = text.split("\n");
    /** @type {Array<[string, string[]]>} */
    const forms = [
      [
        "a short commit",
        [
          lines[0].replace(/ at [0-9a-f]{40}$/, " at abcdef"),
          ...lines.slice(1),
        ],
      ],
      [
        "a wrong path",
        [lines[0].replace("tools/src/", "tools/lib/"), ...lines.slice(1)],
      ],
      [
        "no «no import» words",
        [
          lines[0],
          lines[1].replace("; no import of tools/", ""),
          ...lines.slice(2),
        ],
      ],
      [
        "a third comment line",
        [lines[0], lines[1], "// more", ...lines.slice(2)],
      ],
      ["the first line gone", lines.slice(1)],
    ];
    for (const [what, damaged] of forms)
      assert.notDeepEqual(
        headerFindings(damaged.join("\n"), bytes, original),
        [],
        `${port}: ${what}`,
      );
  }
  // The two originals are not the same file, and the headers do not swap them.
  const [a, b] = PORTS;
  const aText = fs.readFileSync(path.join(OFFICE, a.port), "utf8");
  assert.notDeepEqual(
    headerFindings(
      aText,
      fs.readFileSync(path.join(ROOT, b.original)),
      b.original,
    ),
    [],
  );
  // The paths of the originals stand in the two headers and nowhere else of app/public (decisions/0123 О18).
  const holders = [];
  /** @param {string} dir */
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (/pixel-office/.test(fs.readFileSync(file, "utf8")))
        holders.push(path.relative(APP, file));
    }
  };
  walk(path.join(APP, "public"));
  assert.deepEqual(holders.sort(), [
    "public/office/grid.js",
    "public/office/sim.js",
  ]);
});

/** The text files under app/public (all of them: pages, scripts, styles, data). */
function publicFiles() {
  /** @type {string[]} */
  const out = [];
  /** @param {string} dir */
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(file);
      else out.push(file);
    }
  };
  walk(path.join(APP, "public"));
  return out;
}

test("PO-2 the route kind is deliver in sim.js and no whole word of the old kind stands in app/public", async () => {
  const sim = await importFile(path.join(OFFICE, "sim.js"));
  const grid = await importFile(path.join(OFFICE, "grid.js"));
  const word = new RegExp(
    `(?<![A-Za-z0-9_])${OLD_KIND}s?(?![A-Za-z0-9_])`,
    "i",
  );
  /** @type {string[]} */
  const holders = [];
  for (const file of publicFiles())
    if (word.test(fs.readFileSync(file, "utf8")))
      holders.push(path.relative(APP, file));
  assert.deepEqual(holders, []);
  assert.ok(!word.test(fs.readFileSync(path.join(OFFICE, "sim.js"), "utf8")));
  assert.match(
    fs.readFileSync(path.join(OFFICE, "sim.js"), "utf8"),
    /kind === "deliver"/,
  );

  // The kind is read by behaviour: on one event index a delivery goes before a result, and a route of
  // the old kind is no delivery. One walker, three routes to three cells.
  const layout = grid.buildLayout(4);
  const office = {
    layout,
    characters: [{ key: "w0", desk_index: 0 }],
  };
  const cells = [layout.desks[1].seat, layout.desks[2].seat];
  /** @param {string[]} kinds @returns {string} the route the walker runs first */
  const firstRoute = (kinds) => {
    const s = sim.createSim();
    s.sync(office);
    s.enqueue(
      kinds.map((kind, k) => ({
        id: `r${k}-${kind}`,
        walker: "w0",
        kind,
        event_index: 5,
        to_cell: cells[k],
        after: null,
      })),
    );
    s.tick(0.05);
    return s.positions()[0].route;
  };
  assert.equal(firstRoute(["result", "deliver"]), "r1-deliver");
  assert.equal(firstRoute(["deliver", "result"]), "r0-deliver");
  // A route of the old kind is ranked as any other kind: the order given stays.
  assert.equal(firstRoute(["result", OLD_KIND]), `r0-result`);
});

// ---------------------------------------------------------------------------------------------------------
// PO-3 the grid.

const originalGrid = await importFile(
  path.join(ROOT, "tools/src/pixel-office/public/layout.js"),
);
const portGrid = await importFile(path.join(OFFICE, "grid.js"));

/**
 * The result of a call or the name of its error, so a call that throws on both sides is equal too.
 * @param {() => unknown} fn
 */
function outcome(fn) {
  try {
    return { value: fn() };
  } catch (err) {
    return { thrown: err instanceof Error ? err.name : String(err) };
  }
}

test("PO-3 grid.js against layout.js: constants, desks, sizes, layouts, cells, steps and every path", () => {
  /** @type {string[]} */
  const different = [];
  let compared = 0;
  /** @param {string} what @param {unknown} a @param {unknown} b */
  const same = (what, a, b) => {
    compared += 1;
    try {
      assert.deepEqual(a, b);
    } catch {
      if (different.length < 20) different.push(what);
      else different.length = 20;
    }
  };

  // Every export of the original is kept under its name with its value; the one export that the port adds
  // is stageMap (its own test is OS-7).
  const names = Object.keys(originalGrid).sort();
  assert.deepEqual(Object.keys(portGrid).sort(), [...names, "stageMap"].sort());
  for (const name of names) {
    const a = originalGrid[name];
    const b = portGrid[name];
    assert.equal(typeof b, typeof a, name);
    if (typeof a === "function") continue;
    same(`constant ${name}`, a, b);
  }

  // deskSpot and officeSize on whole, negative, fractional and wrong inputs.
  const inputs = [
    ...Array.from({ length: 50 }, (_, k) => k),
    -1,
    1.5,
    Number.NaN,
    "3",
    null,
    undefined,
    2 ** 31,
    Number.MAX_SAFE_INTEGER,
    {},
  ];
  for (const d of inputs) {
    same(
      `deskSpot(${String(d)})`,
      outcome(() => originalGrid.deskSpot(d)),
      outcome(() => portGrid.deskSpot(d)),
    );
    same(
      `officeSize(${String(d)})`,
      outcome(() => originalGrid.officeSize(d)),
      outcome(() => portGrid.officeSize(d)),
    );
  }

  // The layouts for 1, 4, 21, 22 and 30 desks, each built by each module: equal, and read the same way.
  const moves = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
    [2, 0],
  ];
  let paths = 0;
  for (const n of [1, 4, 21, 22, 30]) {
    const a = originalGrid.buildLayout(n);
    const b = portGrid.buildLayout(n);
    same(`buildLayout(${n})`, a, b);
    assert.equal(b.desks.length, n);
    /** @type {Array<[number, number]>} */
    const walkableCells = [];
    for (let x = a.min_x - 2; x <= a.max_x + 2; x++) {
      for (let y = -2; y <= a.height + 1; y++) {
        same(
          `cellKind ${n} ${x},${y}`,
          originalGrid.cellKind(a, x, y),
          portGrid.cellKind(b, x, y),
        );
        const w = originalGrid.walkable(a, x, y);
        same(`walkable ${n} ${x},${y}`, w, portGrid.walkable(b, x, y));
        if (w) walkableCells.push([x, y]);
        for (const [dx, dy] of moves)
          same(
            `canStep ${n} ${x},${y} by ${dx},${dy}`,
            originalGrid.canStep(a, x, y, x + dx, y + dy),
            portGrid.canStep(b, x, y, x + dx, y + dy),
          );
      }
    }
    // Cells that are no whole numbers, and the border of the layout.
    for (const [x, y] of [
      [0.5, 1],
      [1, 0.5],
      [Number.NaN, 1],
      [a.min_x - 1, 3],
      [a.max_x + 1, 3],
    ]) {
      same(
        `kind ${n} ${x},${y}`,
        originalGrid.cellKind(a, x, y),
        portGrid.cellKind(b, x, y),
      );
      same(
        `step ${n} ${x},${y}`,
        originalGrid.canStep(a, x, y, x + 1, y),
        portGrid.canStep(b, x, y, x + 1, y),
      );
    }
    // findPath from every seat to every walkable cell.
    for (const desk of a.desks) {
      for (const cell of walkableCells) {
        paths += 1;
        same(
          `findPath ${n} ${desk.seat} -> ${cell}`,
          originalGrid.findPath(a, desk.seat, cell),
          portGrid.findPath(b, desk.seat, cell),
        );
      }
    }
    // Paths with a step function of the caller's (no step to the right).
    /** @param {any} g */
    const noRight =
      (g) =>
      (
        /** @type {unknown} */ l,
        /** @type {number} */ x,
        /** @type {number} */ y,
        /** @type {number} */ nx,
        /** @type {number} */ ny,
      ) =>
        nx <= x && g.canStep(l, x, y, nx, ny);
    const seat = a.desks[0].seat;
    for (const cell of walkableCells.slice(0, 40))
      same(
        `custom step ${n} ${cell}`,
        originalGrid.findPath(a, seat, cell, noRight(originalGrid)),
        portGrid.findPath(b, seat, cell, noRight(portGrid)),
      );
    for (const [from, to] of [
      [null, seat],
      [seat, null],
      [seat, seat],
      [seat, [a.max_x + 5, 3]],
      [[a.min_x - 1, 3], seat],
      [seat, [1.5, 3]],
      ["ab", seat],
      [seat, [Number.NaN, 3]],
    ])
      same(
        `findPath wrong ${n} ${String(from)} -> ${String(to)}`,
        outcome(() => originalGrid.findPath(a, from, to)),
        outcome(() => portGrid.findPath(b, from, to)),
      );
  }
  // The comparisons are many: a loop that compared nothing would pass.
  assert.ok(compared > 60000, `only ${compared} comparisons`);
  assert.ok(paths > 10000, `only ${paths} paths`);
  assert.deepEqual(different, []);
});

// ---------------------------------------------------------------------------------------------------------
// PO-4 the movement.

const originalSim = await importFile(
  path.join(ROOT, "tools/src/pixel-office/public/office-sim.js"),
);
const portSim = await importFile(path.join(OFFICE, "sim.js"));

/**
 * A scenario: the number of desks and characters, and the things that happen at a tick (the number of the
 * tick, from 0, before it): each a function of the sim, the layout and a kind translator. Every scenario is
 * run on the original and on the port with the same calls, 200 ticks of 0.05 s.
 * @typedef {{ name: string, desks: number, characters: number, at: Record<number, Array<(ctx: Ctx) => void>> }} Scenario
 * @typedef {{ sim: any, layout: any, layoutOf: (n: number) => any, kind: (k: string) => string, cells: Array<[number, number]>, closed: Array<[number, number]> }} Ctx
 */

/**
 * @param {string} id
 * @param {string} walker
 * @param {string} kind
 * @param {number} index
 * @param {number} cell the index in the reachable cells of the layout, or -1 for a cell no walker reaches
 * @param {string | null} [after]
 * @returns {(ctx: Ctx) => { id: string, walker: string, kind: string, event_index: number, to_cell: [number, number], after: string | null }}
 */
const route =
  (id, walker, kind, index, cell, after = null) =>
  (ctx) => ({
    id,
    walker,
    kind: ctx.kind(kind),
    event_index: index,
    to_cell: cell === -1 ? ctx.closed[0] : ctx.cells[cell % ctx.cells.length],
    after,
  });
/**
 * @param {Array<ReturnType<typeof route>>} makers
 * @param {{ seen?: boolean }} [options]
 * @returns {(ctx: Ctx) => void}
 */
const enqueue = (makers, options) => (ctx) =>
  ctx.sim.enqueue(
    makers.map((m) => m(ctx)),
    options,
  );

/** @type {Scenario[]} */
const SCENARIOS = [
  {
    name: "one walker",
    desks: 4,
    characters: 1,
    at: {
      0: [
        enqueue([
          route("a", "w0", "deliver", 1, 400),
          route("b", "w0", "result", 2, 900),
        ]),
      ],
      120: [enqueue([route("c", "w0", "deliver", 3, 1500)])],
    },
  },
  {
    name: "several walkers",
    desks: 4,
    characters: 4,
    at: {
      0: [
        enqueue([
          route("a", "w0", "deliver", 1, 700),
          route("b", "w1", "deliver", 2, 1200),
          route("c", "w2", "result", 3, 300),
          route("d", "w3", "deliver", 4, 1900),
        ]),
      ],
      60: [enqueue([route("e", "w1", "result", 5, 50)])],
    },
  },
  {
    name: "an after route that waits for another",
    desks: 4,
    characters: 3,
    at: {
      0: [
        enqueue([
          route("a", "w0", "deliver", 1, 1500),
          route("b", "w1", "deliver", 2, 800, "a"),
          route("c", "w2", "result", 3, 100, "b"),
          route("d", "w1", "result", 4, 2000, "zzz"),
        ]),
      ],
    },
  },
  {
    name: "a target that no walker can reach",
    desks: 4,
    characters: 2,
    at: {
      0: [
        enqueue([
          route("a", "w0", "deliver", 1, -1),
          route("b", "w0", "result", 2, 600, "a"),
          route("c", "w1", "deliver", 3, 1100),
        ]),
      ],
    },
  },
  {
    name: "a route of an unknown walker",
    desks: 4,
    characters: 2,
    at: {
      0: [
        enqueue([
          route("a", "ghost", "deliver", 1, 400),
          route("b", "w1", "deliver", 2, 900),
          route("c", "w1", "result", 3, 20, "a"),
        ]),
      ],
    },
  },
  {
    name: "a route of a walker that comes later",
    desks: 4,
    characters: 1,
    at: {
      0: [enqueue([route("a", "w2", "deliver", 1, 700)])],
      20: [
        (ctx) =>
          ctx.sim.sync({
            layout: ctx.layout,
            characters: [0, 1, 2].map((k) => ({
              key: `w${k}`,
              desk_index: k,
            })),
          }),
      ],
      25: [enqueue([route("a", "w2", "deliver", 1, 700)])],
    },
  },
  {
    name: "a route repeated by id",
    desks: 4,
    characters: 2,
    at: {
      0: [
        enqueue([
          route("a", "w0", "deliver", 1, 600),
          route("a", "w1", "deliver", 1, 1100),
        ]),
      ],
      30: [enqueue([route("a", "w0", "result", 9, 1700)])],
      150: [
        enqueue([
          route("a", "w0", "result", 9, 1700),
          route("b", "w0", "result", 10, 1700),
        ]),
      ],
    },
  },
  {
    name: "the two kinds on one event index",
    desks: 4,
    characters: 2,
    at: {
      0: [
        enqueue([
          route("r1", "w0", "result", 7, 1300),
          route("d1", "w0", "deliver", 7, 400),
          route("r2", "w1", "result", 7, 1800),
          route("d2", "w1", "deliver", 7, 2200),
          route("d3", "w0", "deliver", 6, 100),
        ]),
      ],
    },
  },
  {
    name: "enqueue with seen true",
    desks: 4,
    characters: 2,
    at: {
      0: [
        enqueue(
          [
            route("a", "w0", "deliver", 1, 500),
            route("b", "w1", "result", 2, 900),
          ],
          { seen: true },
        ),
      ],
      10: [
        enqueue([
          route("a", "w0", "deliver", 1, 500),
          route("c", "w1", "deliver", 3, 1400),
        ]),
      ],
    },
  },
  {
    name: "a pause",
    desks: 4,
    characters: 3,
    at: {
      0: [enqueue([route("a", "w0", "deliver", 1, 900)])],
      20: [(ctx) => ctx.sim.setPaused(true)],
      30: [
        enqueue([
          route("b", "w1", "result", 2, 1600),
          route("c", "w2", "deliver", 3, 300),
        ]),
      ],
      90: [(ctx) => ctx.sim.setPaused(false)],
      130: [(ctx) => ctx.sim.setPaused("yes")],
      150: [(ctx) => ctx.sim.setPaused(false)],
    },
  },
  ...[1, 2, 4].map((m) => ({
    name: `the speed ${m}`,
    desks: 4,
    characters: 4,
    at: {
      0: [
        (/** @type {Ctx} */ ctx) => ctx.sim.setSpeed(m),
        enqueue([
          route("a", "w0", "deliver", 1, 1000),
          route("b", "w1", "result", 2, 1700),
          route("c", "w2", "deliver", 3, 250),
        ]),
      ],
      100: [(/** @type {Ctx} */ ctx) => ctx.sim.setSpeed(3)],
    },
  })),
  {
    name: "the speed 3 is no speed",
    desks: 4,
    characters: 1,
    at: {
      0: [
        (ctx) => ctx.sim.setSpeed(4),
        (ctx) => ctx.sim.setSpeed(3),
        (ctx) => ctx.sim.setSpeed(0),
        (ctx) => ctx.sim.setSpeed("2"),
        enqueue([route("a", "w0", "deliver", 1, 1000)]),
      ],
    },
  },
  {
    name: "the office grows and shrinks during walks",
    desks: 4,
    characters: 3,
    at: {
      0: [
        enqueue([
          route("a", "w0", "deliver", 1, 1500),
          route("b", "w1", "deliver", 2, 1700),
          route("c", "w2", "result", 3, 300),
        ]),
      ],
      25: [
        (ctx) => {
          const layout = ctx.layoutOf(22);
          ctx.sim.sync({
            layout,
            characters: [0, 1, 2].map((k) => ({
              key: `w${k}`,
              desk_index: k + 18,
            })),
          });
        },
      ],
      70: [
        (ctx) => {
          const layout = ctx.layoutOf(4);
          ctx.sim.sync({
            layout,
            characters: [{ key: "w0", desk_index: 0 }],
          });
        },
      ],
      110: [enqueue([route("d", "w0", "result", 4, 600)])],
    },
  },
];

/**
 * A trace of a scenario on one module pair: after each of 200 ticks of 0.05 s, the positions, the cell of
 * every character, the pause and the speed.
 * @param {any} simModule
 * @param {any} gridModule
 * @param {boolean} isOriginal
 * @param {Scenario} scenario
 */
function trace(simModule, gridModule, isOriginal, scenario) {
  const sim = simModule.createSim();
  const layouts = new Map();
  /** @param {number} n */
  const layoutOf = (n) => {
    if (!layouts.has(n)) layouts.set(n, gridModule.buildLayout(n));
    return layouts.get(n);
  };
  const layout = layoutOf(scenario.desks);
  // The cells a walker of the first desk can reach (a closed room is walkable and not reachable), and the
  // first one it cannot.
  /** @type {Array<[number, number]>} */
  const cells = [];
  /** @type {Array<[number, number]>} */
  const closed = [];
  for (let x = layout.min_x; x <= layout.max_x; x++)
    for (let y = 0; y < layout.height; y++)
      if (gridModule.walkable(layout, x, y)) {
        const found = gridModule.findPath(layout, layout.desks[0].seat, [x, y]);
        if (found !== null && found.length > 2) cells.push([x, y]);
        else if (found === null) closed.push([x, y]);
      }
  const ctx = {
    sim,
    layout,
    layoutOf,
    cells,
    closed,
    kind: (/** @type {string} */ k) =>
      isOriginal && k === "deliver" ? OLD_KIND : k,
  };
  sim.sync({
    layout,
    characters: Array.from({ length: scenario.characters }, (_, k) => ({
      key: `w${k}`,
      desk_index: k,
    })),
  });
  /** @type {unknown[]} */
  const out = [];
  for (let tick = 0; tick < 200; tick++) {
    for (const act of scenario.at[tick] ?? []) act(ctx);
    sim.tick(0.05);
    out.push({
      positions: sim.positions(),
      cells: Array.from({ length: scenario.characters + 1 }, (_, k) =>
        sim.cell(`w${k}`),
      ),
      paused: sim.isPaused(),
      speed: sim.getSpeed(),
    });
  }
  return out;
}

test("PO-4 sim.js against office-sim.js: the constants and the positions after each of 200 ticks of the fixture scripts", () => {
  assert.equal(portSim.SPEED, originalSim.SPEED);
  assert.equal(portSim.PAUSE, originalSim.PAUSE);
  assert.deepEqual(portSim.SPEEDS, originalSim.SPEEDS);
  assert.deepEqual(Object.keys(portSim).sort(), [
    "PAUSE",
    "SPEED",
    "SPEEDS",
    "createSim",
    "createWalker",
  ]);
  assert.equal(SCENARIOS.length, 15);
  for (const scenario of SCENARIOS) {
    const a = /** @type {any[]} */ (
      trace(originalSim, originalGrid, true, scenario)
    );
    const b = /** @type {any[]} */ (trace(portSim, portGrid, false, scenario));
    assert.equal(a.length, 200);
    const firstDifferent = a.findIndex((_, k) => {
      try {
        assert.deepEqual(a[k], b[k]);
        return false;
      } catch {
        return true;
      }
    });
    assert.equal(
      firstDifferent,
      -1,
      `${scenario.name}: the first different tick is ${firstDifferent}`,
    );
    // The fixture moves somebody: a scenario that never walks proves nothing.
    const walked = a.filter((t) =>
      t.positions.some((p) => p.state === "walking"),
    ).length;
    assert.ok(walked > 20, `${scenario.name}: walked in ${walked} ticks`);
  }
});
