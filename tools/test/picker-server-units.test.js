// SU-1 ... SU-14: the modules of the server one by one (design REQ-056, 9.2): the
// arguments of `serve`, the routes, the language, the form of a body, the texts, the type
// of a body, the version, tame and show, the registry of tenants, the key texts, the stub
// of the page, the files of the page, the constants and the form of a result.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import * as config from "../src/picker/config.js";
import { fingerprintOf } from "../src/picker/fingerprint.js";
import { tame, show } from "../src/picker/places.js";
import { assetType, readAsset } from "../src/picker/assets.js";
import {
  errorBody,
  textInAllLanguages,
  textOf,
} from "../src/picker/messages.js";
import { publicResult } from "../src/picker/public-data.js";
import {
  checkBody,
  isJsonType,
  languageOf,
  routeOf,
  splitTarget,
} from "../src/picker/request.js";
import { parseServeArguments } from "../src/picker/serve.js";
import { TEXTS } from "../src/picker/public/texts.js";
import { inspectDirectory, loadTenants } from "../src/picker/tenants.js";
import { installFaults } from "./fault-inject.js";
import { deepFreeze } from "./picker-engine-helpers.js";
import { PICKER, makeTmp } from "./picker-helpers.js";
import {
  IDS,
  LANGS,
  PUBLIC_DIR,
  SERVER_TEXTS,
  demoBytes,
  demoDir,
  legacyBytes,
  makeTenantDir,
  sha256,
  sourceOf,
} from "./picker-server-helpers.js";

const SEE = "Справка: npm run picker -- --help";
const NO_TENANTS =
  "Не указана папка арендаторов. Пример: npm run picker -- serve --tenants <папка>";
const needs = (key) => `Ключ ${key} требует значение.`;
const port = (shown) => `Порт — целое число от 0 до 65535 (сейчас: ${shown}).`;

// ---------------------------------------------------------------------- SU-1

test("SU-1: parseServeArguments - the refusals of design 4.2 as literals, the right forms, the order of the refusals (a stray word, an unknown key, a repeat, no value - from left to right - then no --tenants, then the port)", () => {
  const refused = [
    [[], NO_TENANTS],
    [["--tenants"], needs("--tenants")],
    [["--port", "--tenants", "x"], needs("--port")],
    [["--tenants", "x", "--port"], needs("--port")],
    [["--tenants", "x", "--port="], needs("--port")],
    [["--tenants=--x"], needs("--tenants")],
    [["--tenants", ""], needs("--tenants")],
    [["--tenants="], needs("--tenants")],
    [["--tenants", "a\u0000b"], needs("--tenants")],
    [["--tenants", "x", "--home", "--port"], needs("--home")],
    [["--home=--p", "--tenants", "x"], needs("--home")],
    [["--tenants", "x", "--bogus"], `Неизвестный ключ --bogus. ${SEE}`],
    [["--tenants", "x", "--help"], `Неизвестный ключ --help. ${SEE}`],
    [["--__proto__", "x"], `Неизвестный ключ --__proto__. ${SEE}`],
    [["--constructor"], `Неизвестный ключ --constructor. ${SEE}`],
    [["--tenants", "x", "--a b"], `Неизвестный ключ --a_b. ${SEE}`],
    [["--tenants", "a", "--tenants", "b"], "Ключ --tenants указан дважды."],
    [["--tenants=a", "--tenants", "b"], "Ключ --tenants указан дважды."],
    [
      ["--tenants", "x", "--port", "1", "--port=2"],
      "Ключ --port указан дважды.",
    ],
    [["--tenants", "x", "word"], `Лишний аргумент word. ${SEE}`],
    [["word"], `Лишний аргумент word. ${SEE}`],
    [["__proto__"], `Лишний аргумент __proto__. ${SEE}`],
    [["x".repeat(50)], `Лишний аргумент ${"x".repeat(40)}…. ${SEE}`],
    [["--tenants", "x", "--port", "abc"], port("abc")],
    [["--tenants", "x", "--port", "70000"], port("70000")],
    [["--tenants", "x", "--port", "65536"], port("65536")],
    [["--tenants", "x", "--port", "1e3"], port("1e3")],
    [["--tenants", "x", "--port", "-1"], port("-1")],
    [["--tenants", "x", "--port", "0x10"], port("0x10")],
    [["--tenants", "x", "--port", "1.5"], port("1.5")],
    [["--tenants", "x", "--port", " 5"], port("_5")],
    [["--tenants", "x", "--port=5 "], port("5_")],
    [["word", "--bogus"], `Лишний аргумент word. ${SEE}`],
    [["--bogus", "--bogus"], `Неизвестный ключ --bogus. ${SEE}`],
    [
      ["--tenants", "x", "--tenants", "y", "word"],
      "Ключ --tenants указан дважды.",
    ],
    [["--port", "abc"], NO_TENANTS],
    [
      ["--tenants", "x", "--port", "abc", "--bogus"],
      `Неизвестный ключ --bogus. ${SEE}`,
    ],
    [["x", "--tenants"], `Лишний аргумент x. ${SEE}`],
  ];
  assert.ok(refused.length >= 34);
  for (const [args, text] of refused) {
    assert.deepEqual(
      parseServeArguments(args),
      { ok: false, text },
      JSON.stringify(args),
    );
  }
  const right = (tenants, home, number) => ({
    ok: true,
    tenants,
    home,
    port: number,
  });
  assert.deepEqual(
    parseServeArguments(["--tenants", "x"]),
    right("x", null, 4782),
  );
  assert.deepEqual(
    parseServeArguments(["--tenants=x"]),
    right("x", null, 4782),
  );
  assert.deepEqual(
    parseServeArguments(["--tenants", "x", "--port", "0"]),
    right("x", null, 0),
  );
  assert.deepEqual(
    parseServeArguments(["--port=0", "--tenants=x"]),
    right("x", null, 0),
  );
  assert.deepEqual(
    parseServeArguments(["--tenants", "x", "--port", "65535"]),
    right("x", null, 65535),
  );
  assert.deepEqual(
    parseServeArguments(["--tenants", "x", "--port", "007"]),
    right("x", null, 7),
  );
  assert.deepEqual(
    parseServeArguments(["--tenants", "x", "--home", "/p"]),
    right("x", "/p", 4782),
  );
  assert.deepEqual(
    parseServeArguments(["--home=/p", "--tenants=x"]),
    right("x", "/p", 4782),
  );
  assert.deepEqual(
    parseServeArguments(["--port", "5", "--home", "h", "--tenants", "t"]),
    right("t", "h", 5),
  );
  assert.deepEqual(
    parseServeArguments(["--tenants", "__proto__"]),
    right("__proto__", null, 4782),
  );
  assert.deepEqual(
    parseServeArguments(["--tenants", "-x"]),
    right("-x", null, 4782),
  );
});

// ---------------------------------------------------------------------- SU-2

test("SU-2: routeOf - 60 paths, every kind of route and every unknown path (a percent sign, two points, empty parts, a capital, 33 signs, a backslash, a null sign, long paths)", () => {
  const page = (id) => ({ kind: "page", id });
  const known = [
    ["/t/uchet-pro/", page("uchet-pro")],
    ["/t/uchet-pro", { kind: "redirect", id: "uchet-pro" }],
    [
      "/t/uchet-pro/api/questionnaire",
      { kind: "questionnaire", id: "uchet-pro" },
    ],
    ["/t/uchet-pro/api/result", { kind: "result", id: "uchet-pro" }],
    ["/assets/stub.js", { kind: "asset", name: "stub.js" }],
    ["/assets/texts.js", { kind: "asset", name: "texts.js" }],
    ["/assets/index.html", { kind: "asset", name: "index.html" }],
    ["/assets/x.exe", { kind: "asset", name: "x.exe" }],
    ["/t/abc/", page("abc")],
    ["/t/a1b/", page("a1b")],
    [`/t/${"a".repeat(32)}/`, page("a".repeat(32))],
    [`/t/${"a".repeat(32)}`, { kind: "redirect", id: "a".repeat(32) }],
    [
      `/assets/${"a".repeat(60)}.js`,
      { kind: "asset", name: `${"a".repeat(60)}.js` },
    ],
    [`/assets/${"a".repeat(64)}`, { kind: "asset", name: "a".repeat(64) }],
    ["/assets/a.b-c_d.js", { kind: "asset", name: "a.b-c_d.js" }],
    ["/t/1a2/api/result", { kind: "result", id: "1a2" }],
  ];
  const unknown = [
    "/",
    "",
    "t/uchet-pro/",
    "/t",
    "/t/",
    "/t//",
    "/t/UCHET-PRO/",
    "/t/UCHET-PRO",
    "/t/uchet%2Dpro/",
    "/t/uchet-pro%2F",
    "/t/../uchet-pro/",
    "/t/./uchet-pro/",
    "/t/uchet-pro/x",
    "/t/uchet-pro/api",
    "/t/uchet-pro/api/",
    "/t/uchet-pro/api/questionnaire/",
    "/t/uchet-pro/api/lead",
    "/t/uchet-pro/api/advice",
    "/t/uchet-pro/api/result/",
    "//t/uchet-pro/",
    "/T/uchet-pro/",
    "/t/uchet-pro//",
    "/t/ab/",
    "/t/ab",
    `/t/${"a".repeat(33)}/`,
    "/t/-ab/",
    "/t/ab-/",
    "/t/a_b/",
    "/t/uchet.pro/",
    "/t/юникод/",
    "/t/uchet-pro\\",
    "/t/uchet-pro%5c/",
    "/t/%2e%2e/uchet-pro/",
    "/t/uchet-pro/%00",
    "/t/uchet\u0000pro/",
    "/assets/",
    "/assets",
    "/assets/..",
    "/assets/../x",
    "/assets/a/b.js",
    "/assets/a\\b.js",
    "/assets/a%00.js",
    "/assets/.hidden",
    "/assets/x..js",
    `/assets/${"a".repeat(65)}`,
    "/favicon.ico",
    "/api/questionnaire",
    `/${"a".repeat(10000)}`,
    `/t/${"a".repeat(8000)}/`,
    "/t/uchet-pro/api/questionnaire/x",
    "/assets/a b.js",
  ];
  assert.ok(known.length + unknown.length >= 60);
  for (const [target, want] of known)
    assert.deepEqual(routeOf(target), want, target);
  for (const target of unknown)
    assert.equal(routeOf(target), null, target.slice(0, 40));
  for (const bad of [undefined, null, 5, {}, [], true])
    assert.equal(routeOf(bad), null);
  // the target is cut at the first question mark and nothing is decoded
  assert.deepEqual(splitTarget("/a?b=c?d"), { pathname: "/a", query: "b=c?d" });
  assert.deepEqual(splitTarget("/a"), { pathname: "/a", query: "" });
  assert.deepEqual(splitTarget("/a?"), { pathname: "/a", query: "" });
  assert.deepEqual(splitTarget("/a%20b"), { pathname: "/a%20b", query: "" });
  assert.deepEqual(splitTarget(5), { pathname: "", query: "" });
  assert.deepEqual(splitTarget(undefined), { pathname: "", query: "" });
});

// ---------------------------------------------------------------------- SU-3

test("SU-3: languageOf - 20 queries on a file of three languages and on a file of one; the first value of lang, only the exact ru, kk, en, a language the file lacks is ru", () => {
  const rows = [
    ["lang=kk", "kk"],
    ["lang=en", "en"],
    ["lang=ru", "ru"],
    ["lang=KK", "ru"],
    ["lang=kk&lang=en", "kk"],
    ["lang=en&lang=kk", "en"],
    ["lang=", "ru"],
    ["lang", "ru"],
    ["a=b&lang=en", "en"],
    ["lang=kk%26en", "ru"],
    ["", "ru"],
    ["?", "ru"],
    ["lang=de", "ru"],
    ["lang=%20kk", "ru"],
    ["lang=kk,en", "ru"],
    ["Lang=kk", "ru"],
    ["lang=%6bk", "kk"],
    ["lang=kk+", "ru"],
    ["x=lang=kk", "ru"],
    ["lang==kk", "ru"],
  ];
  assert.equal(rows.length, 20);
  for (const [query, wanted] of rows) {
    assert.equal(languageOf(query, ["ru", "kk", "en"]), wanted, query);
    assert.equal(languageOf(query, ["ru"]), "ru", `${query} (one language)`);
    assert.equal(
      languageOf(query, ["ru", "kk"]),
      wanted === "en" ? "ru" : wanted,
      `${query} (two languages)`,
    );
  }
  for (const bad of [undefined, null, 5, ["lang=kk"], {}])
    assert.equal(languageOf(bad, ["ru", "kk", "en"]), "ru");
  assert.equal(languageOf("lang=kk", undefined), "ru");
});

// ---------------------------------------------------------------------- SU-4

test("SU-4: checkBody - an object with the one key answers is right (whatever answers holds); every other form is told with its key of the texts; an extra key is told before the lack of answers, in the order of the keys", () => {
  const bad = { ok: false, key: "server_bad_request" };
  const extra = (field) => ({ ok: false, key: "server_extra_field", field });
  assert.deepEqual(checkBody({ answers: {} }), { ok: true, answers: {} });
  assert.deepEqual(checkBody({ answers: 5 }), { ok: true, answers: 5 });
  assert.deepEqual(checkBody({ answers: null }), { ok: true, answers: null });
  assert.deepEqual(checkBody({ answers: [1] }), { ok: true, answers: [1] });
  assert.deepEqual(checkBody({}), { ok: false, key: "server_no_answers" });
  assert.deepEqual(checkBody({ tenant: "x" }), extra("tenant"));
  assert.deepEqual(checkBody({ answers: {}, tenant: 1 }), extra("tenant"));
  assert.deepEqual(checkBody({ tenant: 1, answers: {} }), extra("tenant"));
  assert.deepEqual(checkBody({ b: 1, a: 2, answers: {} }), extra("b"));
  assert.deepEqual(checkBody({ Answers: {} }), extra("Answers"));
  for (const value of [[], null, 5, "s", true, undefined, [{ answers: {} }]])
    assert.deepEqual(checkBody(value), bad, String(value));
  assert.deepEqual(
    checkBody(JSON.parse('{"__proto__":{},"answers":{}}')),
    extra("__proto__"),
  );
  assert.deepEqual(
    checkBody(JSON.parse('{"__proto__":{"answers":{}}}')),
    extra("__proto__"),
  );
  const bare = Object.assign(Object.create(null), { answers: { a: 1 } });
  assert.deepEqual(checkBody(bare), { ok: true, answers: { a: 1 } });
  assert.deepEqual(checkBody(Object.create({ answers: {} })), {
    ok: false,
    key: "server_no_answers",
  });
  const frozen = deepFreeze({ answers: { a: [1] } });
  assert.doesNotThrow(() => checkBody(frozen));
});

// ---------------------------------------------------------------------- SU-5

test("SU-5: textOf puts a value in by a function ($&, $1, $` and {field} in a value stay letters), leaves an unnamed placeholder, throws for an unknown key or language; textInAllLanguages joins the three with ' / '; errorBody gives { error, message, ...extra }", () => {
  for (const value of ["$&", "$1", "$`", "$$", "{field}", "a{field}b", "‮"]) {
    for (const lang of LANGS) {
      const want = SERVER_TEXTS.server_extra_field[LANGS.indexOf(lang)].replace(
        "{field}",
        () => value,
      );
      assert.equal(
        textOf("server_extra_field", lang, { field: value }),
        want,
        `${lang} ${value}`,
      );
    }
  }
  assert.equal(
    textOf("server_extra_field", "ru"),
    "В запросе лишнее поле {field}. Удалите его.",
  );
  assert.equal(
    textOf("server_extra_field", "ru", { other: "x" }),
    "В запросе лишнее поле {field}. Удалите его.",
  );
  assert.equal(
    textOf("server_not_found", "kk", { field: "x" }),
    "Бет табылмады.",
  );
  assert.equal(
    textOf("server_extra_field", "en", { field: 5 }),
    "The request has an extra field 5. Remove it.",
  );
  assert.throws(() => textOf("no_such_key", "ru"));
  assert.throws(() => textOf("constructor", "ru"));
  assert.throws(() => textOf("server_not_found", "de"));
  assert.throws(() => textOf("server_not_found", "__proto__"));
  assert.throws(() => textOf(5, "ru"));
  assert.equal(
    textInAllLanguages("server_not_found"),
    "Страница не найдена. / Бет табылмады. / Page not found.",
  );
  assert.equal(
    textInAllLanguages("server_extra_field", { field: "$&" }),
    "В запросе лишнее поле $&. Удалите его. / Сұрауда артық $& өрісі бар. Оны алып тастаңыз. / The request has an extra field $&. Remove it.",
  );
  assert.equal(
    errorBody("not_found", "server_not_found", null),
    '{"error":"not_found","message":"Страница не найдена. / Бет табылмады. / Page not found."}',
  );
  assert.equal(
    errorBody(
      "answers_invalid",
      "server_answers_invalid",
      "kk",
      {},
      { question: "q1" },
    ),
    JSON.stringify({
      error: "answers_invalid",
      message: SERVER_TEXTS.server_answers_invalid[1],
      question: "q1",
    }),
  );
  assert.equal(
    errorBody(
      "answers_invalid",
      "server_answers_invalid",
      "en",
      {},
      { question: null },
    ),
    JSON.stringify({
      error: "answers_invalid",
      message: SERVER_TEXTS.server_answers_invalid[2],
      question: null,
    }),
  );
  assert.deepEqual(
    Object.keys(JSON.parse(errorBody("x", "server_not_found", "ru"))),
    ["error", "message"],
  );
});

// ---------------------------------------------------------------------- SU-6

test("SU-6: isJsonType - the part before ';' without spaces and tabs at the ends, in lower case, is application/json", () => {
  const yes = [
    "application/json",
    "application/json; charset=utf-8",
    "APPLICATION/JSON",
    " application/json",
    "application/json ",
    "\tapplication/json\t",
    "application/json;",
    "Application/Json;charset=x",
  ];
  const no = [
    "application/jsonx",
    "application/json5",
    "text/json",
    "json",
    "",
    "application /json",
    "application/json/",
    "text/plain; application/json",
    "xapplication/json",
    "application/ json",
  ];
  for (const value of yes)
    assert.equal(isJsonType(value), true, JSON.stringify(value));
  for (const value of no)
    assert.equal(isJsonType(value), false, JSON.stringify(value));
  for (const value of [undefined, null, 5, ["application/json"], {}])
    assert.equal(isJsonType(value), false);
  assert.ok(yes.length + no.length >= 14);
});

// ---------------------------------------------------------------------- SU-7

test("SU-7: fingerprintOf - the sha256 vectors of the empty bytes and of 'abc', 64 signs in lower case, the same for Uint8Array and Buffer", () => {
  assert.equal(
    fingerprintOf(new Uint8Array(0)),
    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  );
  assert.equal(
    fingerprintOf(Buffer.from("abc")),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
  assert.equal(
    fingerprintOf(new Uint8Array(Buffer.from("abc"))),
    fingerprintOf(Buffer.from("abc")),
  );
  assert.match(fingerprintOf(Buffer.from("x")), /^[0-9a-f]{64}$/u);
  assert.equal(fingerprintOf(Buffer.from("x")), sha256(Buffer.from("x")));
  assert.notEqual(
    fingerprintOf(Buffer.from("x")),
    fingerprintOf(Buffer.from("x\n")),
  );
});

// ---------------------------------------------------------------------- SU-8

test("SU-8: tame keeps a name (also with the word token), turns spaces and controls into '_' and cuts at 40 signs with '…'; show hides the words that a message must not hold and cuts as before", () => {
  assert.equal(tame("token-shop.json"), "token-shop.json");
  assert.equal(tame("a b\tc\nd"), "a_b_c_d");
  assert.equal(tame("a\u0001b\u202ec"), "a_b_c");
  assert.equal(tame("x".repeat(40)), "x".repeat(40));
  assert.equal(tame("x".repeat(41)), `${"x".repeat(40)}…`);
  assert.equal(tame("😀".repeat(41)), `${"😀".repeat(40)}…`);
  assert.equal(tame("ты"), "ты");
  assert.equal(tame("null"), "null");
  assert.equal(tame(5), "5");
  assert.equal(show("token"), "(скрыто)");
  assert.equal(show("ты"), "(скрыто)");
  assert.equal(show("a b"), "a_b");
  assert.equal(show("x".repeat(41)), `${"x".repeat(40)}…`);
  assert.equal(show("token-shop.json"), "(скрыто)");
  assert.equal(show("plain.json"), "plain.json");
});

// ---------------------------------------------------------------------- SU-9

test("SU-9: loadTenants - a folder of two, the order of ids, the files that are not .json skipped, frozen records with the views and the questionnaires, a name such as constructor is no tenant, one language for a file of the form /1; inspectDirectory has its four refusals", (t) => {
  const dir = makeTenantDir(t, {
    "uchet-pro.json": demoBytes("uchet-pro"),
    "svet-marketing.json": demoBytes("svet-marketing"),
    "notes.txt": "x",
    "readme.md": "y",
  });
  const loaded = loadTenants(dir);
  assert.deepEqual(loaded.notServed, []);
  const registry = loaded.registry;
  assert.deepEqual(registry.ids(), ["svet-marketing", "uchet-pro"]);
  assert.equal(registry.size, 2);
  assert.notEqual(registry.ids(), registry.ids());
  for (const name of [
    "constructor",
    "__proto__",
    "toString",
    "hasOwnProperty",
    "",
    "UCHET-PRO",
  ])
    assert.equal(registry.get(name), undefined, name);
  const entry = registry.get("uchet-pro");
  assert.deepEqual(Object.keys(entry), [
    "id",
    "fileName",
    "version",
    "languages",
    "views",
    "questionnaires",
  ]);
  assert.equal(entry.id, "uchet-pro");
  assert.equal(entry.fileName, "uchet-pro.json");
  assert.equal(entry.version, sha256(demoBytes("uchet-pro")));
  assert.deepEqual(entry.languages, ["ru", "kk", "en"]);
  assert.equal(Object.isFrozen(entry), true);
  assert.equal(Object.isFrozen(entry.languages), true);
  assert.deepEqual([...entry.views.keys()], ["ru", "kk", "en"]);
  assert.deepEqual([...entry.questionnaires.keys()], ["ru", "kk", "en"]);
  for (const view of entry.views.values()) {
    assert.equal(Object.isFrozen(view), true);
    assert.equal(Object.isFrozen(view.questions), true);
    assert.equal(Object.isFrozen(view.questions[0]), true);
    assert.equal(Object.isFrozen(view.solutions[0].includes), true);
  }
  for (const body of entry.questionnaires.values())
    assert.ok(Buffer.isBuffer(body));
  assert.notDeepEqual(entry.views.get("ru").intro, entry.views.get("kk").intro);
  // a file of the form /1
  const old = makeTenantDir(t, { "uchet-pro.json": legacyBytes("uchet-pro") });
  const one = loadTenants(old).registry.get("uchet-pro");
  assert.deepEqual(one.languages, ["ru"]);
  assert.equal(one.questionnaires.size, 1);
  assert.equal(one.views.size, 1);
  // a tenant called constructor
  const odd = JSON.parse(demoBytes("uchet-pro").toString("utf8"));
  odd.id = "constructor";
  const named = makeTenantDir(t, { "constructor.json": JSON.stringify(odd) });
  const reg = loadTenants(named).registry;
  assert.deepEqual(reg.ids(), ["constructor"]);
  assert.equal(reg.get("constructor").id, "constructor");
  assert.equal(reg.get("toString"), undefined);
  // the four refusals
  assert.deepEqual(inspectDirectory(dir), { ok: true });
  const name = path.basename(dir);
  assert.deepEqual(inspectDirectory(path.join(dir, "no-such")), {
    ok: false,
    text: "Папка арендаторов не найдена: no-such. Проверьте путь.",
  });
  assert.deepEqual(inspectDirectory(path.join(dir, "notes.txt")), {
    ok: false,
    text: "notes.txt — не папка. Укажите папку с файлами арендаторов.",
  });
  assert.deepEqual(inspectDirectory(path.join(dir, "notes.txt", "below")), {
    ok: false,
    text: "Папка арендаторов не найдена: below. Проверьте путь.",
  });
  const loop = makeTmp(t);
  fs.symlinkSync(path.join(loop, "b"), path.join(loop, "a"));
  fs.symlinkSync(path.join(loop, "a"), path.join(loop, "b"));
  assert.deepEqual(inspectDirectory(path.join(loop, "a")), {
    ok: false,
    text: "Не удалось прочитать папку a (ELOOP). Проверьте папку.",
  });
  if (typeof process.getuid === "function" && process.getuid() !== 0) {
    const locked = makeTmp(t);
    const inner = path.join(locked, "tenants");
    fs.mkdirSync(inner);
    fs.chmodSync(locked, 0o000);
    let got;
    try {
      got = inspectDirectory(inner);
    } finally {
      fs.chmodSync(locked, 0o700);
    }
    assert.deepEqual(got, {
      ok: false,
      text: "Нет права читать папку tenants. Проверьте права.",
    });
  }
  assert.equal(
    loadTenants(path.join(dir, "no-such")).error,
    "Папка арендаторов не найдена: no-such. Проверьте путь.",
  );
  assert.ok(name.length > 0);
});

// ---------------------------------------------------------------------- SU-10

const SOURCE_KEYS = () => {
  const keys = new Set();
  for (const file of fs.readdirSync(PICKER).filter((f) => f.endsWith(".js"))) {
    for (const m of sourceOf(file).matchAll(
      /"(server_[a-z_]+|page_stub_notice)"/gu,
    ))
      keys.add(m[1]);
  }
  for (const m of sourceOf("public/stub.js").matchAll(
    /TEXTS\.(page_stub_notice)/gu,
  ))
    keys.add(m[1]);
  return keys;
};
const word = (w) =>
  new RegExp(`(?<![\\p{L}\\p{N}])${w}(?![\\p{L}\\p{N}])`, "iu");

test("SU-10: the 11 keys server_* and page_stub_notice are in TEXTS and equal the texts of the table; each is used in the code and each key used exists; the placeholders are the same in the three languages; none of the words of REQ-057 or REQ-058 is in them", () => {
  const keys = Object.keys(SERVER_TEXTS);
  assert.equal(keys.filter((k) => k.startsWith("server_")).length, 11);
  for (const key of keys) {
    assert.ok(Object.hasOwn(TEXTS, key), key);
    assert.deepEqual(
      [TEXTS[key].ru, TEXTS[key].kk, TEXTS[key].en],
      SERVER_TEXTS[key],
      key,
    );
  }
  const used = SOURCE_KEYS();
  for (const key of keys) assert.ok(used.has(key), `dead: ${key}`);
  for (const key of used)
    assert.ok(Object.hasOwn(TEXTS, key), `missing: ${key}`);
  const forbiddenParts = ["арендатор", "конфигурац", "configur"];
  const forbiddenWords = ["json", "api", "сервер", "tenant", "server", "id"];
  const price = [
    "цена",
    "стоимость",
    "срок",
    "руб",
    "гарант",
    "кепіл",
    "price",
    "cost",
    "duration",
    "guarant",
    "баға",
    "құны",
    "мерзім",
  ];
  for (const key of keys) {
    const placeholders = LANGS.map((l) =>
      [...TEXTS[key][l].matchAll(/\{[a-z]+\}/gu)]
        .map((m) => m[0])
        .sort()
        .join(),
    );
    assert.equal(new Set(placeholders).size, 1, key);
    for (const l of LANGS) {
      const text = TEXTS[key][l].toLowerCase();
      for (const part of forbiddenParts)
        assert.equal(text.includes(part), false, `${key} ${l}: ${part}`);
      for (const w of forbiddenWords)
        assert.doesNotMatch(TEXTS[key][l], word(w), `${key} ${l}: ${w}`);
      for (const p of price)
        assert.equal(text.includes(p), false, `${key} ${l}: ${p}`);
    }
  }
});

// ---------------------------------------------------------------------- SU-11

test("SU-11: stub.js run in Node with a location and a document that the test gives - for no query, ?lang=kk, ?lang=en, ?lang=de and ?lang=KK the language of the document and the text of #app are those of page_stub_notice", async (t) => {
  const file = path.join(PUBLIC_DIR, "stub.js");
  const cases = [
    ["", "ru"],
    ["?lang=kk", "kk"],
    ["?lang=en", "en"],
    ["?lang=de", "ru"],
    ["?lang=KK", "ru"],
  ];
  const saved = {
    location: globalThis.location,
    document: globalThis.document,
  };
  t.after(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete globalThis[key];
      else globalThis[key] = value;
    }
  });
  for (const [index, [search, lang]] of cases.entries()) {
    const app = { textContent: "" };
    const doc = {
      documentElement: { lang: "" },
      getElementById: (id) => (id === "app" ? app : null),
    };
    globalThis.location = { search };
    globalThis.document = doc;
    await import(`${file}?case=${index}`);
    assert.equal(doc.documentElement.lang, lang, search);
    assert.equal(app.textContent, TEXTS.page_stub_notice[lang], search);
    assert.equal(
      app.textContent,
      SERVER_TEXTS.page_stub_notice[LANGS.indexOf(lang)],
    );
  }
});

// ---------------------------------------------------------------------- SU-12

test("SU-12: assetType and readAsset - eight wrong names, a link, a folder named x.js, a pipe and a missing file give null; an ordinary file gives its bytes and type; a failure of the system (EIO) is an exception, not a null", (t) => {
  const refused = [
    "..",
    `${"a".repeat(65)}.js`,
    "x.exe",
    "",
    "a/b.js",
    "a\\b.js",
    "a\u0000b.js",
    "..\\x.js",
    ".hidden.js",
    "x..js",
  ];
  for (const name of refused) {
    assert.equal(assetType(name), null, JSON.stringify(name));
    assert.equal(readAsset(PUBLIC_DIR, name), null, JSON.stringify(name));
  }
  for (const bad of [undefined, null, 5]) assert.equal(assetType(bad), null);
  assert.equal(assetType("a.html"), "text/html; charset=utf-8");
  assert.equal(assetType("a.js"), "text/javascript; charset=utf-8");
  assert.equal(assetType("a.css"), "text/css; charset=utf-8");
  assert.equal(assetType("a.svg"), null);
  assert.equal(assetType("a.json"), null);
  assert.equal(assetType("a.JS"), null);
  const dir = makeTmp(t);
  fs.writeFileSync(path.join(dir, "real.js"), "export const x = 1;\n");
  fs.symlinkSync(path.join(dir, "real.js"), path.join(dir, "link.js"));
  fs.mkdirSync(path.join(dir, "x.js"));
  assert.equal(spawnSync("mkfifo", [path.join(dir, "pipe.js")]).status, 0);
  const asset = readAsset(dir, "real.js");
  assert.deepEqual(asset, {
    type: "text/javascript; charset=utf-8",
    bytes: Buffer.from("export const x = 1;\n"),
  });
  for (const name of ["link.js", "x.js", "pipe.js", "missing.js"])
    assert.equal(readAsset(dir, name), null, name);
  const faults = installFaults([
    {
      fn: "openSync",
      paths: [path.join(dir, "real.js")],
      effect: "throw",
      code: "EIO",
    },
  ]);
  try {
    assert.throws(
      () => readAsset(dir, "real.js"),
      (err) => err.code === "EIO",
    );
  } finally {
    faults.restore();
  }
  assert.ok(readAsset(dir, "real.js") !== null);
  assert.ok(readAsset(PUBLIC_DIR, "texts.js").bytes.length > 100);
});

// ---------------------------------------------------------------------- SU-13

test("SU-13: config - the values of design 5.1 as literals and the policy of nine parts", () => {
  assert.equal(config.HOST, "127.0.0.1");
  assert.equal(config.DEFAULT_PORT, 4782);
  assert.equal(config.BODY_MAX, 16384);
  assert.equal(config.BODY_IDLE_MS, 15000);
  assert.equal(config.DRAIN_MAX, 8 * 1024 * 1024);
  assert.equal(config.DRAIN_IDLE_MS, 5000);
  assert.equal(config.MAX_HEADER_BYTES, 16384);
  assert.equal(config.HEADERS_TIMEOUT_MS, 10000);
  assert.equal(config.REQUEST_TIMEOUT_MS, 30000);
  assert.equal(config.KEEP_ALIVE_MS, 5000);
  assert.equal(config.CHECK_INTERVAL_MS, 1000);
  assert.equal(config.MAX_TENANT_FILES, 100);
  assert.equal(config.JSON_TYPE, "application/json; charset=utf-8");
  assert.equal(config.PAGE_FILE, "index.html");
  assert.equal(
    config.CSP,
    "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; object-src 'none'",
  );
  assert.equal(config.CSP.split("; ").length, 9);
  assert.equal(config.STATIC_NAME.source, "^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$");
  assert.deepEqual(
    { ...config.STATIC_TYPES },
    {
      ".html": "text/html; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
      ".css": "text/css; charset=utf-8",
    },
  );
  assert.deepEqual(Object.keys(config).sort(), [
    "BODY_IDLE_MS",
    "BODY_MAX",
    "CHECK_INTERVAL_MS",
    "CSP",
    "DEFAULT_PORT",
    "DRAIN_IDLE_MS",
    "DRAIN_MAX",
    "HEADERS_TIMEOUT_MS",
    "HOST",
    "JSON_TYPE",
    "KEEP_ALIVE_MS",
    "MAX_HEADER_BYTES",
    "MAX_TENANT_FILES",
    "PAGE_FILE",
    "REQUEST_TIMEOUT_MS",
    "STATIC_NAME",
    "STATIC_TYPES",
  ]);
});

// ---------------------------------------------------------------------- SU-14

test("SU-14: publicResult takes ranking out, keeps everything else in its order and does not change a frozen input", () => {
  const result = deepFreeze({
    clear_leader: true,
    recommended: [{ id: "a", score: 3, rules: [] }],
    no_match_text: null,
    ranking: [
      { solution: "a", score: 3 },
      { solution: "b", score: -2 },
    ],
    hypotheses: [{ id: "h" }],
  });
  const out = publicResult(result);
  assert.deepEqual(Object.keys(out), [
    "clear_leader",
    "recommended",
    "no_match_text",
    "hypotheses",
  ]);
  assert.equal(Object.hasOwn(out, "ranking"), false);
  assert.equal(JSON.stringify(out).includes('"b"'), false);
  assert.deepEqual(out.recommended, result.recommended);
  assert.equal(Object.hasOwn(result, "ranking"), true);
  assert.deepEqual(publicResult({ ranking: [] }), {});
  assert.deepEqual(IDS.length, 2);
  assert.ok(demoDir !== undefined);
});
