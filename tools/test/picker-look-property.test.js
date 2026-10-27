// LP-1 ... LP-3: failures do not bring the system down and nothing extra is added
// (design docs/design/REQ-069-tenant-look-format.md, section 11.2): 500 hostile variants
// of the sample through the real command with a pinned seed, a server on a folder with
// broken files of the form /3, and the scans of the source text. The expectations are the
// shape of the lines of picker-helpers.js and the helpers of picker-look-helpers.js.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import {
  PICKER,
  TOOLS,
  fileDigest,
  lineProblems,
  makeRng,
  makeTmp,
  put,
  runPicker,
} from "./picker-helpers.js";
import {
  MINIMAL,
  changed,
  lookFixtureBytes,
  lookFixtureJson,
  minimal3,
  okLine,
} from "./picker-look-helpers.js";
import { placeText } from "./picker-lang-helpers.js";
import {
  NOT_FOUND_BODY,
  listingDigest,
  makeTenantDir,
  request,
  startForTest,
} from "./picker-server-helpers.js";

const FILE = `${MINIMAL}.json`;
const DEEP = "__DEEP_NESTING__";
const REMOVE = Symbol("remove");

// ---------------------------------------------------------------------- the variants

// The places of the sample that the property changes: every node of the look, the desk of
// each question, the quick numbers (the list and each item), the office object of each
// option (the object and each of its fields) and the three new fields of the leads.
function placesOf(doc) {
  const out = [];
  const walk = (value, at) => {
    out.push(at);
    if (Array.isArray(value)) value.forEach((v, i) => walk(v, [...at, i]));
    else if (value !== null && typeof value === "object")
      for (const key of Object.keys(value)) walk(value[key], [...at, key]);
  };
  walk(doc.look, ["look"]);
  doc.questions.forEach((q, i) => {
    if (Object.hasOwn(q, "desk")) out.push(["questions", i, "desk"]);
    if (Object.hasOwn(q, "chips")) walk(q.chips, ["questions", i, "chips"]);
    (q.options ?? []).forEach((o, j) => {
      if (Object.hasOwn(o, "object"))
        walk(o.object, ["questions", i, "options", j, "object"]);
    });
  });
  for (const key of ["whatsapp", "max_per_hour", "max_stored"])
    out.push(["leads", key]);
  return out;
}

const FAMILIES = (at) =>
  at[0] === "look"
    ? "look"
    : at[0] === "leads"
      ? at[1]
      : at.includes("chips")
        ? "chips"
        : at.includes("object")
          ? "object"
          : "desk";

const HOSTILE = [
  ["number", () => 12345],
  ["null", () => null],
  ["list", () => [1, "a", null]],
  ["empty object", () => ({})],
  [
    "languages in a language",
    () => ({
      ru: { ru: "а", kk: "а", en: "a" },
      kk: { ru: "а", kk: "а", en: "a" },
      en: { ru: "а", kk: "а", en: "a" },
    }),
  ],
  ["100 000 signs", () => "а".repeat(100000)],
  ["nesting of 20 000", () => DEEP],
  ["removed", () => REMOVE],
];

// The text of a variant: the sample with one change; the nesting is written as text
// because a value of that depth cannot be built and written in one piece.
function variantText(edits, base = minimal3()) {
  const real = edits.map(([at, value]) => [
    at,
    value === REMOVE ? undefined : value,
  ]);
  const text = JSON.stringify(changed(real, base));
  return text.replace(`"${DEEP}"`, `${"[".repeat(20000)}${"]".repeat(20000)}`);
}

const ENUMERATED = [
  5,
  null,
  [],
  {},
  "x",
  "q".repeat(1000),
  [1, "a", null, [], {}],
  [{ desk: 1 }, { desk: "x" }, 7],
];

test("LP-1: 500 variants of ok-minimal.json (a pinned seed; 484 drawn and 16 listed) - a field of the look, a desk, quick numbers, an office object or a lead field becomes a number, null, a list, an empty object, languages inside a language, a text of 100 000 signs, a nesting of 20 000 or is removed; `questions` and `questions[2]` take each of eight values; the command gives code 0 or 1, stderr stays empty, no line of a stack, every line has the shape and a code of the ten, and the file stays", (t) => {
  const dir = makeTmp(t);
  const rng = makeRng(0x69);
  const places = placesOf(lookFixtureJson(MINIMAL));
  const variants = [];
  for (let i = 0; i < 484; i++) {
    const at = rng.pick(places);
    const [kind, make] = rng.pick(HOSTILE);
    variants.push({
      label: `${placeText(at)} <- ${kind}`,
      kind,
      at,
      value: make(),
    });
  }
  for (const at of [["questions"], ["questions", 2]])
    for (const value of ENUMERATED)
      variants.push({
        label: `${placeText(at)} <- ${JSON.stringify(value).slice(0, 40)}`,
        kind: "listed",
        at,
        value,
      });
  assert.equal(variants.length, 500);
  const seen = { code0: 0, code1: 0, families: new Set(), kinds: new Set() };
  for (const v of variants) {
    const text = variantText([[v.at, v.value]]);
    const file = put(dir, FILE, text);
    const digest = fileDigest(file);
    const run = runPicker(["check", file]);
    assert.ok(run.code === 0 || run.code === 1, `${v.label}: code ${run.code}`);
    assert.equal(run.signal, null, v.label);
    assert.deepEqual(run.err, [], v.label);
    assert.equal(
      run.out.some((l) => /^ {4}at /u.test(l)),
      false,
      v.label,
    );
    if (run.code === 0) {
      assert.deepEqual(run.out, [okLine(MINIMAL)], v.label);
      seen.code0++;
    } else {
      assert.deepEqual(lineProblems(run.out), [], v.label);
      for (const line of run.out)
        assert.ok(
          line === "И ещё ошибок: 1." ||
            line.startsWith(`${FILE}: `) ||
            /^И ещё ошибок: \d+\.$/u.test(line),
          `${v.label}: ${line.slice(0, 80)}`,
        );
      seen.code1++;
    }
    if (v.value === DEEP) {
      assert.equal(run.code, 1, v.label);
      assert.equal(run.out.length, 1, v.label);
      assert.match(
        run.out[0],
        /^ok-minimal\.json: строка \d+, знак \d+: E_JSON: /u,
        v.label,
      );
    }
    assert.deepEqual(fileDigest(file), digest, `${v.label}: the file stays`);
    if (v.kind !== "listed") {
      seen.families.add(FAMILIES(v.at));
      seen.kinds.add(v.kind);
    }
  }
  // the draw reached every family and every kind of hostile value
  assert.deepEqual([...seen.families].sort(), [
    "chips",
    "desk",
    "look",
    "max_per_hour",
    "max_stored",
    "object",
    "whatsapp",
  ]);
  assert.equal(seen.kinds.size, HOSTILE.length);
  assert.ok(
    seen.code1 > 300,
    JSON.stringify({ code0: seen.code0, code1: seen.code1 }),
  );
  assert.ok(seen.code0 > 0, "the removal of an optional field is right");
});

// ---------------------------------------------------------------------- LP-2

test("LP-2: a server on a folder with one good /3 file and 20 broken variants (each with its id equal to its file name, so no line is about the id) - the command refuses each at the changed place, the server starts, the good tenant answers 200 with the same bytes as without the broken files, each broken address answers 404 as an unknown tenant, the folder is not changed", async (t) => {
  const rng = makeRng(0x6920);
  const base = minimal3();
  const places = placesOf(lookFixtureJson(MINIMAL));
  const kinds = HOSTILE.filter(
    ([kind]) => kind !== "removed" && kind !== "nesting of 20 000",
  );
  const variants = [];
  const seenPlaces = new Set();
  while (variants.length < 20) {
    const at = rng.pick(places);
    const [kind, make] = rng.pick(kinds);
    const key = placeText(at);
    if (seenPlaces.has(key)) continue;
    seenPlaces.add(key);
    const n = String(variants.length + 1).padStart(2, "0");
    variants.push({ id: `bad-${n}`, at, kind, value: make() });
  }
  const files = { [FILE]: lookFixtureBytes(MINIMAL) };
  for (const v of variants) {
    const doc = changed([[v.at, v.value]], base);
    doc.id = v.id;
    files[`${v.id}.json`] = JSON.stringify(doc);
  }
  const dir = makeTenantDir(t, files);
  // the command refuses each variant at the changed place and never about the id
  for (const v of variants) {
    const file = path.join(dir, `${v.id}.json`);
    const digest = fileDigest(file);
    const run = runPicker(["check", file]);
    const place = placeText(v.at);
    assert.equal(run.code, 1, `${v.id} ${place}`);
    assert.deepEqual(run.err, [], v.id);
    assert.equal(
      run.out.some((l) => l.includes(": E_ID: ")),
      false,
      `${v.id}: no E_ID`,
    );
    assert.ok(
      run.out.some((l) => {
        const at = l.slice(`${v.id}.json: `.length);
        return (
          at.startsWith(`${place}: `) ||
          at.startsWith(`${place}.`) ||
          at.startsWith(`${place}[`)
        );
      }),
      `${v.id}: a line at ${place}: ${run.out.join(" | ").slice(0, 300)}`,
    );
    assert.deepEqual(lineProblems(run.out), [], v.id);
    assert.deepEqual(fileDigest(file), digest, `${v.id}: the file stays`);
  }
  const folder = listingDigest(dir);
  // the server with the broken files, and a second one with the good file alone
  const s = await startForTest(t, dir);
  for (const v of variants)
    assert.ok(s.err.includes(`Арендатор ${v.id}.json не обслуживается:`), v.id);
  assert.equal(s.err.filter((l) => /не обслуживается:$/u.test(l)).length, 20);
  const alone = await startForTest(
    t,
    makeTenantDir(t, { [FILE]: lookFixtureBytes(MINIMAL) }),
  );
  assert.deepEqual(alone.err, []);
  for (const lang of ["ru", "kk", "en"]) {
    const route = `/t/${MINIMAL}/api/questionnaire?lang=${lang}`;
    const withBroken = await request(s.port, { path: route });
    const without = await request(alone.port, { path: route });
    assert.equal(withBroken.status, 200, lang);
    assert.equal(without.status, 200, lang);
    assert.equal(withBroken.text, without.text, `${lang}: the same bytes`);
  }
  for (const v of variants) {
    for (const route of [`/t/${v.id}/api/questionnaire`, `/t/${v.id}/`]) {
      const res = await request(s.port, { path: route });
      assert.equal(res.status, 404, route);
    }
    const res = await request(s.port, { path: `/t/${v.id}/api/questionnaire` });
    assert.equal(res.text, NOT_FOUND_BODY, v.id);
  }
  assert.deepEqual(listingDigest(dir), folder, "the folder is not changed");
});

// ---------------------------------------------------------------------- LP-3

const read = (...parts) => fs.readFileSync(path.join(PICKER, ...parts), "utf8");

test("LP-3: the scans of the source text - the files of the core hold none of the words of the guard tests (writing, network, node:, listing, clock, the escaped sign patterns of the text rules); the shared module holds none of the words that the page tests look for; package.json has the same scripts and no dependencies", () => {
  const CORE_NEW = ["shape.js", "v3-check.js"];
  const CORE_CHANGED = [
    "limits.js",
    "lang-check.js",
    "view.js",
    "validate.js",
    "public-data.js",
  ];
  const WRITING = [
    "writeFile",
    "appendFile",
    "mkdir",
    "rename",
    "unlink",
    "rmSync",
    "copyFile",
    "truncate",
    "chmod",
    "utimes",
    "createWriteStream",
    "O_WRONLY",
    "O_RDWR",
    "O_CREAT",
  ];
  const NETWORK =
    /fetch[(]|https?[.]request|https?[.]get[(]|node:net|node:dgram|child_process|Math[.]random/u;
  const CLOCK =
    /new Date|Date[.]now|Math[.]random|performance[.]now|process[.]env/u;
  const ESCAPED = [
    "\\p{Cc}",
    "\\p{Cf}",
    "\\p{Cs}",
    "\\u2028",
    "\\u2029",
    "\\u200b",
    "\\u202e",
    "\\ufeff",
    "\\u0085",
  ];
  for (const name of [...CORE_NEW, ...CORE_CHANGED]) {
    const text = read(name);
    for (const word of WRITING)
      assert.doesNotMatch(
        text,
        new RegExp(`\\b${word}`, "u"),
        `${name}: ${word}`,
      );
    assert.doesNotMatch(text, NETWORK, name);
    assert.doesNotMatch(text, /readdir|opendir|glob/u, name);
    assert.doesNotMatch(text, CLOCK, name);
  }
  for (const name of [
    ...CORE_NEW,
    "limits.js",
    "lang-check.js",
    "view.js",
    "public-data.js",
  ]) {
    const text = read(name);
    assert.equal(text.includes("node:"), false, `${name}: node:`);
  }
  for (const name of [
    ...CORE_NEW,
    ...CORE_CHANGED,
    path.join("public", "tenant-look.js"),
  ]) {
    const text = read(name);
    for (const pattern of ESCAPED)
      assert.equal(
        text.toLowerCase().includes(pattern.toLowerCase()),
        false,
        `${name}: ${pattern}`,
      );
  }
  // the id pattern stays in one place
  for (const name of [
    ...CORE_NEW,
    "validate.js",
    "lang-check.js",
    "view.js",
    "public-data.js",
  ])
    assert.equal(/TENANT_ID\s*=/u.test(read(name)), false, name);
  // the words of the page tests in the shared module (comments count)
  const shared = read("public", "tenant-look.js");
  const PAGE_WORDS = [
    "alert(",
    "confirm(",
    "prompt(",
    "showModal",
    "beforeunload",
    "dialog",
    "innerHTML",
    "insertAdjacentHTML",
    "outerHTML",
    "document.write",
    "console.",
    "setTimeout",
    "setInterval",
    "requestAnimationFrame",
    "matchMedia",
    "XMLHttpRequest",
    "eval(",
    "new Function",
    "import(",
    "localStorage",
    "sessionStorage",
    "indexedDB",
    "document",
    "cookie",
    "postMessage",
    "window.open",
    "location",
    "pushState",
    "history.",
    "navigator.",
    "scrollTo",
    "AbortSignal",
    "fetch(",
    "WebSocket",
    "EventSource",
    "sendBeacon",
    "importScripts",
    "child_process",
    "Math.random",
    "http://",
    "https://",
    "computeResult",
    "resolveAnswers",
    "visibleQuestions",
    "handoff",
    "ORCH",
    "decisions",
    "setAttribute(",
    ".style",
  ];
  for (const word of PAGE_WORDS)
    assert.equal(shared.includes(word), false, `tenant-look.js: ${word}`);
  assert.doesNotMatch(shared, /accept-language/iu);
  assert.doesNotMatch(shared, /engine/iu);
  assert.doesNotMatch(shared, /REQ-\d/u);
  assert.equal(/^\s*(let|var|export let)\b/mu.test(shared), false);
  // package.json
  const pkg = JSON.parse(
    fs.readFileSync(path.join(TOOLS, "package.json"), "utf8"),
  );
  assert.equal(Object.hasOwn(pkg, "dependencies"), false);
  assert.deepEqual(Object.keys(pkg.scripts), [
    "prepare-run",
    "validate",
    "apply-verdict",
    "snapshot",
    "snapshot-diff",
    "pixel-office",
    "pixel-office-note",
    "team",
    "team-web",
    "traces",
    "handoffs-check",
    "handoff",
    "picker",
    "format",
    "format:check",
    "lint",
    "test",
    "check",
  ]);
  assert.equal(pkg.scripts.picker, "node src/picker/cli.js");
  assert.equal(
    pkg.scripts.check,
    "npm run format:check && npm run lint && npm run traces && npm run handoffs-check && npm run test",
  );
  // the search of the criterion over the whole core, outside public/
  const NETWORK_WORDS =
    /fetch[(]|https?[.]request|node:net|node:dgram|child_process|Math[.]random/u;
  for (const name of fs.readdirSync(PICKER).filter((f) => f.endsWith(".js")))
    assert.doesNotMatch(read(name), NETWORK_WORDS, name);
});
