import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import { blank, specifiersOf } from "../fixtures/blank.js";
import { APP } from "../fixtures/helpers.js";

// REQ-112 criteria 3 and 9: the four pure modules of the office renderer (grid.js, sim.js, stage-scene.js,
// draw.js) import only each other, name no page, clock or chance and leave their inputs unchanged; and no
// file of app/public/office reads an event or sends anything (the scene shows no agent event).

const OFFICE = path.join(APP, "public", "office");
const PURE = ["grid.js", "sim.js", "stage-scene.js", "draw.js"];
const read = (/** @type {string} */ name) =>
  fs.readFileSync(path.join(OFFICE, name), "utf8");

/** The names of criterion 3, none of which a pure module may hold as a whole identifier. */
const NAMES = [
  "document",
  "window",
  "globalThis",
  "self",
  "navigator",
  "localStorage",
  "sessionStorage",
  "indexedDB",
  "matchMedia",
  "requestAnimationFrame",
  "cancelAnimationFrame",
  "setTimeout",
  "setInterval",
  "performance",
  "Date",
  "fetch",
  "XMLHttpRequest",
  "WebSocket",
  "EventSource",
];

// ---------------------------------------------------------------------------------------------------------
// The static rules.

/**
 * Whether a source has an `import` or `export … from` or a dynamic import that names no string literal
 * (so that the specifiers above cannot be trusted), or `import.meta`.
 * @param {string} src
 * @returns {boolean}
 */
function hasOddImport(src) {
  const code = blank(src);
  return /\bimport\s*\(\s*[^"'`\s)]|\bimport\s*\.\s*meta\b|\brequire\s*\(/.test(
    code,
  );
}

/**
 * A name as a whole identifier in code that has been blanked: no letter, digit, `_` or `$` right before or
 * after it, and no `.` before it (so `opts.window` is a property, not the global).
 * @param {string} name
 * @returns {RegExp}
 */
const wholeIdentifier = (name) =>
  new RegExp(`(?<![\\w$.])${name}(?![\\w$])`, "g");

/**
 * The findings of OP-1 and OP-2 for one source of a pure module: an import of anything but another pure
 * module, a name of the list of criterion 3 as a whole identifier, and `Math.random`, all after comments,
 * strings and template text are blanked.
 * @param {string} src
 * @returns {string[]}
 */
function pureFindings(src) {
  /** @type {string[]} */
  const out = [];
  for (const spec of specifiersOf(src))
    if (!PURE.map((n) => `./${n}`).includes(spec)) out.push(`imports ${spec}`);
  if (hasOddImport(src)) out.push("an import that is not a plain string");
  const code = blank(src);
  for (const name of NAMES)
    if (wholeIdentifier(name).test(code)) out.push(`names ${name}`);
  if (/(?<![\w$.])Math\s*\.\s*random(?![\w$])/.test(code))
    out.push("names Math.random");
  return out;
}

test("OP-1 the four pure modules import only each other", () => {
  assert.deepEqual(fs.readdirSync(OFFICE).sort(), [
    "draw.js",
    "grid.js",
    "labels.js",
    "sim.js",
    "stage-scene.js",
    "view.js",
  ]);
  for (const name of PURE) {
    const src = read(name);
    const specs = specifiersOf(src);
    for (const spec of specs) {
      assert.match(spec, /^\.\/[a-z-]+\.js$/, `${name}: ${spec}`);
      assert.ok(PURE.includes(spec.slice(2)), `${name} imports ${spec}`);
      assert.notEqual(spec.slice(2), name, `${name} imports itself`);
    }
    assert.ok(!hasOddImport(src), name);
    // The two modules that import another say so: the chain is the one of the design (sim reads grid).
    if (name === "sim.js") assert.deepEqual(specs, ["./grid.js"]);
    if (name === "grid.js") assert.deepEqual(specs, []);
    if (name === "stage-scene.js") assert.deepEqual(specs, []);
    if (name === "draw.js") assert.deepEqual(specs, []);
  }
  // The page modules are the ones that import the page: they are not pure, and no pure module is one.
  for (const name of PURE)
    assert.ok(
      !specifiersOf(read(name)).some((s) => /view|labels|dom|theme/.test(s)),
      name,
    );
  // The rule gives its findings on a copy that imports a page module or anything of the app.
  for (const spec of [
    "./view.js",
    "./labels.js",
    "../js/dom.js",
    "node:fs",
    "x",
  ])
    assert.deepEqual(
      pureFindings(`import { a } from "${spec}";\nexport const b = a;\n`),
      [`imports ${spec}`],
      spec,
    );
  assert.notDeepEqual(
    pureFindings(`export const m = await import(spec);\n`),
    [],
  );
});

test("OP-2 after blanking none of the four pure modules names a page, clock or chance, nor Math.random", () => {
  for (const name of PURE) {
    const code = blank(read(name));
    // The blanking keeps every line and offset: the same number of lines, and the code is still there.
    assert.equal(code.split("\n").length, read(name).split("\n").length);
    assert.match(code, /export /, name);
    for (const n of NAMES)
      assert.equal(wholeIdentifier(n).test(code), false, `${name} names ${n}`);
    assert.equal(
      /Math\s*\.\s*random/.test(code),
      false,
      `${name}: Math.random`,
    );
    assert.deepEqual(pureFindings(read(name)), [], name);
  }
});

// ---------------------------------------------------------------------------------------------------------
// OP-3 and OP-4: the modules run while the names are trapped.

/** The names that Node 22 defines among those of criterion 3, besides the one function Math.random. */
const TRAPPED = [
  "navigator",
  "setTimeout",
  "setInterval",
  "performance",
  "Date",
  "fetch",
  "WebSocket",
];
/** The names of the list that Node 22 does not define: a use of one of them fails at its use. */
const UNDEFINED = NAMES.filter(
  (n) => !TRAPPED.includes(n) && n !== "globalThis",
);

/**
 * Runs `fn` while every name of TRAPPED is a getter on globalThis that records the read and throws, and
 * Math.random is a function that does the same. The descriptors are saved before the first trap is set
 * (reading the descriptor of fetch loads Node's own fetch, which reads performance, so a trap set before
 * that read would fire on Node and not on the module), and restored after, whatever `fn` does.
 * @template T
 * @param {() => Promise<T>} fn
 * @returns {Promise<{ value: T, reads: string[] }>}
 */
async function underTraps(fn) {
  /** @type {string[]} */
  const reads = [];
  const saved = TRAPPED.map((name) => [
    name,
    /** @type {PropertyDescriptor} */ (
      Object.getOwnPropertyDescriptor(globalThis, name)
    ),
  ]);
  const savedRandom = Math.random;
  try {
    for (const [name] of saved)
      Object.defineProperty(globalThis, String(name), {
        configurable: true,
        get() {
          reads.push(String(name));
          throw new Error(`a trapped read of ${String(name)}`);
        },
        set() {},
      });
    Math.random = () => {
      reads.push("Math.random");
      throw new Error("a trapped call of Math.random");
    };
    return { value: await fn(), reads };
  } finally {
    Math.random = savedRandom;
    for (const [name, descriptor] of saved)
      Object.defineProperty(
        globalThis,
        String(name),
        /** @type {PropertyDescriptor} */ (descriptor),
      );
  }
}

let fresh = 0;
/**
 * A fresh instance of a module of the office: the same file, a query on its URL, so its top level runs
 * again.
 * @param {string} name
 * @returns {Promise<any>}
 */
const importFresh = (name) =>
  import(`${pathToFileURL(path.join(OFFICE, name)).href}?pure=${(fresh += 1)}`);

const GET = (/** @type {string} */ name) =>
  name === "--sc-dim-alpha" ? ".15" : "#a1b2c3";
const WORDS = Object.freeze({
  stages: ["s1", "s2", "s3", "s4"],
  roles: ["r1", "r2", "r3", "r4"],
  you: "you",
  doorName: "door",
  doorTagline: "tag",
});

/**
 * The calls of the test on the four modules (each fresh): every export the scene needs, with inputs of the
 * test's own. Returns what they answered, as plain data, and the inputs after the calls.
 * @param {{ grid: any, sim: any, scene: any, draw: any }} mods
 * @param {any} inputs
 */
function exercise(mods, inputs) {
  const { grid, sim, scene, draw } = mods;
  const layout = inputs.layout;
  const out = /** @type {Record<string, unknown>} */ ({});
  // grid.js
  out.size = grid.officeSize(4);
  out.spot = grid.deskSpot(2);
  out.layout = grid.buildLayout(4);
  out.kinds = [
    [8, 1],
    [9, 2],
    [0, 0],
    [30, 5],
  ].map(([x, y]) => [
    grid.cellKind(layout, x, y),
    grid.walkable(layout, x, y),
    grid.canStep(layout, x, y, x + 1, y),
  ]);
  out.path = grid.findPath(layout, layout.desks[0].seat, layout.desks[3].seat);
  const map = grid.stageMap(120);
  out.stage = [
    grid.cellKind(map, 5, 0),
    grid.findPath(map, [3, 0], [9, 0]),
    grid.walkable(map, 120, 0),
  ];
  // sim.js (its grid is the one grid.js of the app, which the fresh sim imports by its own URL)
  const s = sim.createSim();
  s.sync(inputs.office);
  s.enqueue(inputs.routes);
  /** @type {unknown[]} */
  const walk = [];
  for (let k = 0; k < 50; k++) {
    s.tick(0.05);
    walk.push(s.positions(), s.cell("w0"));
  }
  out.walk = walk;
  const walker = sim.createWalker({ map: inputs.map, x: 24 });
  /** @type {unknown[]} */
  const steps = [walker.walkTo(200)];
  for (let k = 0; k < 30; k++) {
    walker.tick(0.05);
    steps.push(walker.position());
  }
  out.walker = steps;
  // stage-scene.js
  const geom = scene.geometry({
    s: 2,
    clientWidth: 390,
    innerHeight: 844,
    narrow: true,
  });
  const state = scene.stateFor("demo", { kind: "question", i: 3 });
  out.geom = geom;
  out.states = [
    scene.stateFor("landing", { kind: "load" }),
    scene.stateFor("how", { kind: "step", n: 2 }),
    state,
    scene.stateFor("demo", { kind: "result" }),
  ];
  out.youX = [scene.youX(geom, "door"), scene.youX(geom, 3)];
  out.camera = [
    scene.cameraOffset(geom, "start"),
    scene.cameraOffset(geom, 4),
    scene.cameraAt(0, 155, 300, 700),
  ];
  const built = scene.buildScene({ words: inputs.words, state, geom });
  out.scene = built;
  out.same = [
    scene.sameDrawn(state, state),
    scene.sameDrawn(state, scene.stateFor("demo", { kind: "result" })),
  ];
  // draw.js, on a context that records what it is given
  /** @type {unknown[]} */
  const fills = [];
  let style = "";
  const ctx = {
    set fillStyle(v) {
      style = String(v);
    },
    get fillStyle() {
      return style;
    },
    fillRect(/** @type {number[]} */ ...a) {
      fills.push([style, ...a]);
    },
  };
  const palette = draw.readPalette(GET, "light");
  out.palette = palette;
  out.alpha = [draw.lightAlpha(0.15, 0.729), draw.lightAlpha("0.5", "0.6561")];
  out.rects = draw.lightRects(geom, state.light);
  out.calls = draw.drawScene(ctx, built, palette, geom, {
    x: 24,
    frame: 0,
    walking: false,
  });
  draw.drawAvatar(ctx, 2, palette, 2);
  out.fills = fills;
  return out;
}

/** @returns {Promise<{ mods: { grid: any, sim: any, scene: any, draw: any }, inputs: any }>} */
async function freshModules() {
  const grid = await importFresh("grid.js");
  const sim = await importFresh("sim.js");
  const scene = await importFresh("stage-scene.js");
  const draw = await importFresh("draw.js");
  // The inputs are made by the grid.js that the fresh sim imports (the one of the app, by its own URL).
  const appGrid = await import(
    pathToFileURL(path.join(OFFICE, "grid.js")).href
  );
  const layout = appGrid.buildLayout(4);
  const map = appGrid.stageMap(400);
  const cell = layout.desks[3].seat;
  return {
    mods: { grid, sim, scene, draw },
    inputs: {
      layout: grid.buildLayout(4),
      map,
      office: {
        layout,
        characters: [
          { key: "w0", desk_index: 0 },
          { key: "w1", desk_index: 1 },
        ],
      },
      routes: [
        {
          id: "a",
          walker: "w0",
          kind: "deliver",
          event_index: 1,
          to_cell: cell,
          after: null,
        },
        {
          id: "b",
          walker: "w1",
          kind: "result",
          event_index: 2,
          to_cell: layout.desks[2].seat,
          after: "a",
        },
      ],
      words: WORDS,
    },
  };
}

test("OP-3 each pure module loads fresh and runs the calls of the test while the clock, the chance and the page are trapped: no read is recorded", async () => {
  // The traps have a meaning only for names that Node defines; the others fail at their use.
  for (const name of TRAPPED)
    assert.ok(Object.getOwnPropertyDescriptor(globalThis, name), name);
  for (const name of UNDEFINED)
    assert.equal(
      Object.getOwnPropertyDescriptor(globalThis, name),
      undefined,
      name,
    );
  const before = Object.fromEntries(
    TRAPPED.map((n) => [n, Object.getOwnPropertyDescriptor(globalThis, n)]),
  );
  const randomBefore = Math.random;

  const { value, reads } = await underTraps(async () => {
    const { mods, inputs } = await freshModules();
    return exercise(mods, inputs);
  });
  assert.deepEqual(reads, []);
  // The calls did their work (a run that returned nothing would record no read either).
  assert.equal(/** @type {any} */ (value).calls > 100, true);
  assert.equal(/** @type {any} */ (value).walk.length, 100);

  // The descriptors are back, and Math.random too.
  for (const n of TRAPPED)
    assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, n), before[n]);
  assert.equal(Math.random, randomBefore);

  // The trap sees a read: a planted module that reads each name is caught by the same wrapper.
  for (const name of [...TRAPPED, "Math.random"]) {
    const { reads: seen } = await underTraps(async () => {
      try {
        if (name === "Math.random") Math.random();
        else void (/** @type {any} */ (globalThis)[name]);
      } catch {
        // the trap throws; the read is what is recorded
      }
    });
    assert.deepEqual(seen, [name], name);
  }
});

test("OP-4 two runs of the same calls give deeply equal results and leave their inputs unchanged", async () => {
  const { mods, inputs } = await freshModules();
  const copy = structuredClone(inputs);
  const { value: first } = await underTraps(async () => exercise(mods, inputs));
  const { value: second } = await underTraps(async () =>
    exercise(mods, inputs),
  );
  assert.deepEqual(second, first);
  assert.deepEqual(inputs, copy);
  // Inputs that are frozen are not written to either (a write to a frozen object throws in strict code).
  const again = await freshModules();
  /** @param {any} o */
  const freezeDeep = (o) => {
    if (o !== null && typeof o === "object" && !Object.isFrozen(o)) {
      Object.freeze(o);
      for (const k of Object.keys(o)) freezeDeep(o[k]);
    }
    return o;
  };
  freezeDeep(again.inputs.office);
  freezeDeep(again.inputs.routes);
  freezeDeep(again.inputs.words);
  const { value: third } = await underTraps(async () =>
    exercise(again.mods, again.inputs),
  );
  assert.deepEqual(third, first);
  // The result is data of the calls alone: the scene holds the words it was given and nothing else.
  /** @type {string[]} */
  const strings = [];
  /** @param {any} v @param {string} key */
  const collect = (v, key) => {
    if (typeof v === "string" && key !== "focus") strings.push(v);
    else if (v !== null && typeof v === "object")
      for (const k of Object.keys(v)) collect(v[k], k);
  };
  collect(/** @type {any} */ (first).scene, "scene");
  assert.deepEqual([...new Set(strings)].sort(), [
    "door",
    "r1",
    "r2",
    "r3",
    "r4",
    "s1",
    "s2",
    "s3",
    "s4",
    "tag",
    "you",
  ]);
});

test("OP-5 the nine planted twins are red, and dateText, opts.window and a comment are green", () => {
  const wrap = (/** @type {string} */ body) =>
    `export function f(u, opts, f) {\n  ${body}\n}\n`;
  /** @type {Array<[string, string]>} */
  const planted = [
    ["Date.now", wrap("return Date.now();")],
    ["new Date", wrap("return new Date();")],
    ["performance.now", wrap("return performance.now();")],
    ["Math.random", wrap("return Math.random();")],
    ["requestAnimationFrame", wrap("return requestAnimationFrame(f);")],
    ["document.title", wrap("return document.title;")],
    ["window.x", wrap("return window.x;")],
    ["fetch", wrap("return fetch(u);")],
    [
      "an import of view.js",
      `import { createStageView } from "./view.js";\n${wrap("return createStageView;")}`,
    ],
  ];
  assert.equal(planted.length, 9);
  for (const [what, src] of planted)
    assert.notDeepEqual(pureFindings(src), [], what);
  // Each is named by its finding, so the test is red for the right reason.
  assert.deepEqual(pureFindings(planted[0][1]), ["names Date"]);
  assert.deepEqual(pureFindings(planted[3][1]), ["names Math.random"]);
  assert.deepEqual(pureFindings(planted[8][1]), ["imports ./view.js"]);
  /** @type {Array<[string, string]>} */
  const green = [
    ["dateText", wrap("const dateText = u; return dateText;")],
    ["opts.window", wrap("return opts.window;")],
    [
      "a comment",
      `// Date and window and Math.random are only words here\n${wrap("return u;")}`,
    ],
  ];
  for (const [what, src] of green)
    assert.deepEqual(pureFindings(src), [], what);
  // The names of strings and templates are no names either (the blanking of the test's reader).
  assert.deepEqual(
    pureFindings(wrap('return "Date" + `window ${u} fetch` + /Date/.source;')),
    [],
  );
  // And a name inside the `${…}` of a template is code.
  assert.notDeepEqual(pureFindings(wrap("return `x ${Date.now()} y`;")), []);
  // Every name of the list is found on its own, and a spelling with other letters around it is not.
  for (const n of NAMES) {
    assert.notDeepEqual(pureFindings(wrap(`return ${n};`)), [], n);
    assert.deepEqual(pureFindings(wrap(`return x${n}y;`)), [], n);
    assert.deepEqual(pureFindings(wrap(`return opts.${n};`)), [], n);
  }
});

// ---------------------------------------------------------------------------------------------------------
// OP-6 the scene reads no event and sends nothing.

/** The names that read an event or send something (criterion 9). */
const NETWORK = [
  "fetch",
  "XMLHttpRequest",
  "WebSocket",
  "EventSource",
  "sendBeacon",
];

/**
 * The findings of OP-6 for one source of app/public/office: a name of NETWORK as a whole identifier (no
 * letter, digit, `_` or `$` right before or after it, a dot before it included) after comments, strings and
 * template text are blanked, or the address `/api` in the raw text (not after a letter, digit, `_`, `$` or
 * `-`, and not before a letter, digit, `_` or `-`).
 * @param {string} src
 * @returns {string[]}
 */
function eventFindings(src) {
  /** @type {string[]} */
  const out = [];
  const code = blank(src);
  for (const name of NETWORK)
    if (new RegExp(`(?<![\\w$])${name}(?![\\w$])`).test(code))
      out.push(`names ${name}`);
  if (/(?<![\w$-])\/api(?![\w-])/.test(src)) out.push("holds /api");
  return out;
}

test("OP-6 no file of app/public/office names a way to read an event or to send, or holds /api; ten planted forms are red and seven twins green", () => {
  const files = fs.readdirSync(OFFICE).filter((f) => f.endsWith(".js"));
  assert.equal(files.length, 6);
  for (const name of files)
    assert.deepEqual(eventFindings(read(name)), [], name);

  const wrap = (/** @type {string} */ body) =>
    `export function f(u, opts) {\n  ${body}\n}\n`;
  /** @type {Array<[string, string, string]>} */
  const planted = [
    ["fetch(u)", wrap("return fetch(u);"), "names fetch"],
    ["opts.fetch(u)", wrap("return opts.fetch(u);"), "names fetch"],
    [
      "new XMLHttpRequest()",
      wrap("return new XMLHttpRequest();"),
      "names XMLHttpRequest",
    ],
    ["new WebSocket(u)", wrap("return new WebSocket(u);"), "names WebSocket"],
    [
      "new EventSource(u)",
      wrap("return new EventSource(u);"),
      "names EventSource",
    ],
    [
      "navigator.sendBeacon(u)",
      wrap("return navigator.sendBeacon(u);"),
      "names sendBeacon",
    ],
    [
      "a string /api/demo/result",
      wrap('return "/api/demo/result";'),
      "holds /api",
    ],
    ["a string '/api'", wrap("return '/api';"), "holds /api"],
    ['a string "./api/x"', wrap('return "./api/x";'), "holds /api"],
    [
      "a template literal with /api?x",
      wrap("return `/api?x=${u}`;"),
      "holds /api",
    ],
  ];
  assert.equal(planted.length, 10);
  for (const [what, src, finding] of planted)
    assert.deepEqual(eventFindings(src), [finding], what);
  /** @type {Array<[string, string]>} */
  const twins = [
    ["prefetch()", wrap("return prefetch();")],
    ["fetchedAt", wrap("return fetchedAt;")],
    ["eventSource", wrap("return eventSource;")],
    ["sendBeacons()", wrap("return sendBeacons();")],
    ["a comment fetch", `// fetch is a word here\n${wrap("return u;")}`],
    ['a string "fetch"', wrap('return "fetch";')],
    ['a string "/apiary"', wrap('return "/apiary";')],
  ];
  assert.equal(twins.length, 7);
  for (const [what, src] of twins)
    assert.deepEqual(eventFindings(src), [], what);
  // The address is read in the raw text, comments included, with its borders.
  assert.deepEqual(eventFindings("// the /api is not used here\n"), [
    "holds /api",
  ]);
  assert.deepEqual(eventFindings(wrap('return "x-/api";')), []);
  assert.deepEqual(eventFindings(wrap('return "a/api";')), []);
  assert.deepEqual(eventFindings(wrap('return "/api-x";')), []);
  assert.deepEqual(eventFindings(wrap('return "/api_x";')), []);
  assert.deepEqual(eventFindings(wrap('return "/api1";')), []);
  assert.deepEqual(eventFindings(wrap('return "/api";')), ["holds /api"]);
  assert.deepEqual(eventFindings(wrap('return "/api/";')), ["holds /api"]);
});
