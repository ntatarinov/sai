// PK-P1 ... PK-P6: the reader of JSON, the check of UTF-8, the BOM and the rule of
// understandable text (design REQ-054, 12.2). The reader must accept and refuse what
// JSON.parse accepts and refuses; three things differ and are tested one by one: a
// repeated key, nesting deeper than 20 and the place of a failure in Russian terms.
import assert from "node:assert/strict";
import { test } from "node:test";
import { checkBytes } from "../src/picker/check.js";
import { lineColumn, parseJson, positionKey } from "../src/picker/json.js";
import { decodeTenantBytes } from "../src/picker/load.js";
import {
  phrasesOf,
  textProblem,
  trimmedLength,
  wordCount,
} from "../src/picker/text-rules.js";
import { firstInvalidUtf8 } from "../src/picker/utf8.js";
import { fixtureBytes, makeRng } from "./picker-helpers.js";

const raz = (n) => Array(n).fill("раз").join(" ");

// ---------------------------------------------------------------------- PK-P1

// Texts of JSON and of what is almost JSON: each is accepted or refused by JSON.parse.
const CORPUS = [
  "{}",
  "[]",
  "0",
  "-0",
  "1",
  "-1",
  "1.5",
  "-1.5e10",
  "1e5",
  "1E+5",
  "1e-5",
  "0.5",
  "10",
  "123456789012345678901234567890",
  '"a"',
  '""',
  '"\\u0041"',
  '"\\ud83d\\ude00"',
  '"\\ud83d"',
  '"\\ude00x"',
  '"\\/"',
  '"\\b\\f\\n\\r\\t"',
  '"\\"\\\\"',
  '"😀"',
  "true",
  "false",
  "null",
  " \t\r\n1 \n",
  '{"a":1}',
  '{"a":[1,2,{"b":null}]}',
  "[1,[2,[3]]]",
  '{"":1}',
  '{ "a" : 1 , "b" : 2 }',
  '{"a":{"b":{"c":[]}}}',
  "[true,false,null]",
  '{"1":1,"0":2,"b":3}',
  "[[],[[]],{}]",
  "[1,2,3]",
  "",
  "   ",
  "{",
  "}",
  "[",
  "]",
  '{"a":',
  '{"a":1,}',
  "[1,]",
  "[,1]",
  "{,}",
  "01",
  "1.",
  ".5",
  "+1",
  "-",
  "1e",
  "1e+",
  "0x10",
  "'a'",
  '"a',
  '"\\x"',
  '"\\u12"',
  '"\\u00G0"',
  '"a\nb"',
  '"\t"',
  "tru",
  "True",
  "nul",
  "NaN",
  "Infinity",
  "-Infinity",
  "[1 2]",
  '{"a" 1}',
  "{a:1}",
  '{"a":1 "b":2}',
  "1 2",
  '{"a":1} x',
  "﻿1",
  " 1",
  "[1,2",
  '{"a":{"b":}}',
  "--1",
  "1..2",
  "1e1.5",
  "1a",
  "[1a]",
  "[1,,2]",
  '{"a":1,,"b":2}',
  '{"a"::1}',
  "[}",
  "{]",
  "// c\n1",
  "/* c */1",
  '"\\u"',
  "\\",
  "nulll",
  "truefalse",
  '{"a":1}}',
  '"\u0000"',
  '"\u001f"',
  "[\u000b1]",
  "[\u00001]",
];

function compare(text) {
  const mine = parseJson(text);
  let theirs;
  try {
    theirs = { ok: true, value: JSON.parse(text) };
  } catch {
    theirs = { ok: false };
  }
  if (mine.ok === theirs.ok) {
    if (mine.ok)
      assert.equal(
        JSON.stringify(mine.value),
        JSON.stringify(theirs.value),
        JSON.stringify(text),
      );
    return "same";
  }
  // The allowed differences: a repeated key and nesting deeper than 20 are refused here.
  assert.equal(
    mine.ok,
    false,
    `accepted what JSON.parse refuses: ${JSON.stringify(text)}`,
  );
  assert.ok(
    ["dup", "depth"].includes(mine.kind),
    `${JSON.stringify(text)}: ${mine.kind}`,
  );
  return mine.kind;
}

test("PK-P1: parseJson accepts and refuses what JSON.parse accepts and refuses - a list of texts and 20000 random strings of 24 signs with a fixed seed; the only differences are a repeated key and nesting deeper than 20", () => {
  assert.ok(CORPUS.length >= 50, `${CORPUS.length} texts`);
  assert.equal(new Set(CORPUS).size, CORPUS.length);
  let accepted = 0;
  for (const text of CORPUS)
    if (compare(text) === "same" && parseJson(text).ok) accepted += 1;
  assert.ok(
    accepted >= 25 && accepted < CORPUS.length - 25,
    `${accepted} accepted of ${CORPUS.length}`,
  );
  const rng = makeRng(54);
  const alphabet = [...'{}[],:"\\01-.etrufalsn +2'];
  assert.equal(alphabet.length, 24);
  let differences = 0;
  let ok = 0;
  for (let i = 0; i < 20000; i++) {
    const length = 1 + rng.int(14);
    let text = "";
    for (let k = 0; k < length; k++) text += rng.pick(alphabet);
    const kind = compare(text);
    if (kind !== "same") differences += 1;
    else if (parseJson(text).ok) ok += 1;
  }
  assert.ok(ok > 100, `${ok} random texts accepted`);
  assert.ok(differences < 100, `${differences} differences`);
  // texts near to valid ones: one sign changed, removed or added in a valid text
  const valid = [
    '{"a":[1,2.5,{"b":"c"}],"d":true}',
    '[null,{"e":-1e3},"x\\n"]',
    '{"k":{"k":{"k":[]}}}',
  ];
  let near = 0;
  for (const base of valid) {
    for (let i = 0; i <= base.length; i++) {
      for (const sign of ['"', ",", ":", "]", "}", " ", "1"]) {
        compare(base.slice(0, i) + sign + base.slice(i));
        if (i < base.length) {
          compare(base.slice(0, i) + sign + base.slice(i + 1));
          compare(base.slice(0, i) + base.slice(i + 1));
        }
        near += 3;
      }
    }
  }
  assert.ok(near > 1000);
});

// ---------------------------------------------------------------------- PK-P2

test("PK-P2: the place of a failure - the calls of design 5.3 and lineColumn", () => {
  const fail = (text) => {
    const r = parseJson(text);
    assert.equal(r.ok, false, text);
    return [r.kind, r.line, r.column, r.key];
  };
  assert.deepEqual(fail('{"a":1,}'), ["char", 1, 8, undefined]);
  assert.deepEqual(fail('{"a":1,"a":2}'), ["dup", 1, 8, "a"]);
  assert.deepEqual(fail(""), ["end", 1, 1, undefined]);
  assert.deepEqual(fail('{"a":1} x'), ["trailing", 1, 9, undefined]);
  assert.deepEqual(fail('{\n  "a": 1\n  "b": 2\n}'), ["char", 3, 3, undefined]);
  assert.deepEqual(fail("[".repeat(21)), ["depth", 1, 21, undefined]);
  assert.deepEqual(fail('"a\nb"')[0], "control");
  assert.deepEqual(fail('{"a":\n'), ["end", 2, 1, undefined]);
  assert.deepEqual(fail('{"a":tru}'), ["char", 1, 9, undefined]);
  // the sample files of design 10.2
  const sample = (name) => {
    const r = checkBytes(fixtureBytes(name), name);
    return r.stdout[0].split(": ").slice(1, 4);
  };
  assert.deepEqual(sample("e-json-syntax.txt"), [
    "строка 3, знак 1",
    "E_JSON",
    "Здесь неожиданный знак. Проверьте запятые, кавычки и скобки.",
  ]);
  assert.deepEqual(sample("e-json-truncated.txt").slice(0, 2), [
    "строка 3, знак 27",
    "E_JSON",
  ]);
  assert.deepEqual(sample("e-json-empty.txt").slice(0, 2), [
    "строка 1, знак 1",
    "E_JSON",
  ]);
  assert.deepEqual(sample("e-json-dup-key.txt").slice(0, 2), [
    "строка 3, знак 3",
    "E_JSON",
  ]);
  assert.deepEqual(sample("e-json-utf8.txt").slice(0, 2), [
    "строка 2, знак 12",
    "E_JSON",
  ]);
  // line and column: a CR belongs to the line it ends, a pair of code units is one sign
  assert.deepEqual(lineColumn("a\r\nb", 2), { line: 1, column: 3 });
  assert.deepEqual(lineColumn("a\r\nb", 3), { line: 2, column: 1 });
  assert.deepEqual(lineColumn("😀x", 2), { line: 1, column: 2 });
  assert.deepEqual(lineColumn("😀x", 3), { line: 1, column: 3 });
  assert.deepEqual(lineColumn("\n\nab", 3), { line: 3, column: 2 });
  assert.deepEqual(lineColumn("abc", 0), { line: 1, column: 1 });
  // the columns in a failure count code points: after an emoji
  assert.deepEqual(fail('["😀",]'), ["char", 1, 6, undefined]);
  // the positions of the members: the start of the key, the start of an element
  const text = '  {"a":[10,20],"b":{"c":1}}';
  const ok = parseJson(text);
  assert.equal(ok.ok, true);
  assert.equal(positionKey(["a", 0]), '["a",0]');
  assert.equal(ok.positions.get(positionKey([])), 2);
  assert.equal(ok.positions.get(positionKey(["a"])), text.indexOf('"a"'));
  assert.equal(ok.positions.get(positionKey(["a", 0])), text.indexOf("10"));
  assert.equal(ok.positions.get(positionKey(["a", 1])), text.indexOf("20"));
  assert.equal(ok.positions.get(positionKey(["b"])), text.indexOf('"b"'));
  assert.equal(ok.positions.get(positionKey(["b", "c"])), text.indexOf('"c"'));
});

// ---------------------------------------------------------------------- PK-P3

test("PK-P3: nesting - 20 levels pass, the 21st is refused; a repeated key in one object is refused, the same key in two objects is not; __proto__ is an ordinary key and the objects have no prototype", () => {
  assert.equal(parseJson("[".repeat(20) + "]".repeat(20)).ok, true);
  const deep = parseJson("[".repeat(21) + "]".repeat(21));
  assert.deepEqual(
    [deep.ok, deep.kind, deep.line, deep.column],
    [false, "depth", 1, 21],
  );
  const objects = (n) => '{"a":'.repeat(n) + "1" + "}".repeat(n);
  assert.equal(parseJson(objects(20)).ok, true);
  assert.equal(parseJson(objects(21)).kind, "depth");
  assert.equal(parseJson(`[${objects(19)}]`).ok, true);
  assert.equal(parseJson(`[${objects(20)}]`).kind, "depth");
  // a repeated key
  assert.equal(parseJson('{"a":1,"b":{"a":2}}').ok, true);
  assert.equal(parseJson('{"a":{"a":1}}').ok, true);
  const dup = parseJson('{"a":1,"b":{"a":2},"a":3}');
  assert.deepEqual(
    [dup.ok, dup.kind, dup.key, dup.column],
    [false, "dup", "a", 20],
  );
  const dupInside = parseJson('{"b":{"c":1,"c":2}}');
  assert.deepEqual([dupInside.kind, dupInside.key], ["dup", "c"]);
  assert.equal(parseJson('{"__proto__":1,"__proto__":2}').kind, "dup");
  // __proto__
  const r = parseJson(
    '{"__proto__":{"x":1},"constructor":2,"toString":3,"list":[{"y":4}]}',
  );
  assert.equal(r.ok, true);
  assert.equal(Object.getPrototypeOf(r.value), null);
  assert.deepEqual(Object.keys(r.value), [
    "__proto__",
    "constructor",
    "toString",
    "list",
  ]);
  assert.equal(Object.getPrototypeOf(r.value.list[0]), null);
  assert.equal(r.value.list[0].y, 4);
  assert.equal(Object.hasOwn(r.value, "__proto__"), true);
  assert.equal(r.value.constructor, 2);
  assert.equal({}.x, undefined, "Object.prototype is not changed");
  assert.equal(
    Object.getPrototypeOf(
      Object.getOwnPropertyDescriptor(r.value, "__proto__").value,
    ),
    null,
  );
  assert.equal(
    Object.getOwnPropertyDescriptor(r.value, "__proto__").value.x,
    1,
  );
});

// ---------------------------------------------------------------------- PK-P4

const TABLE = [
  [[], -1],
  [[0x41], -1],
  [[0x7f], -1],
  [[0x80], 0],
  [[0xbf], 0],
  [[0xc0, 0x80], 0],
  [[0xc1, 0xbf], 0],
  [[0xc2, 0x80], -1],
  [[0xdf, 0xbf], -1],
  [[0xc2], 0],
  [[0xe0, 0x80, 0x80], 0],
  [[0xe0, 0xa0, 0x80], -1],
  [[0xe1, 0x80, 0x80], -1],
  [[0xed, 0xa0, 0x80], 0],
  [[0xed, 0x9f, 0xbf], -1],
  [[0xee, 0x80, 0x80], -1],
  [[0xef, 0xbf, 0xbf], -1],
  [[0xe2, 0x82], 0],
  [[0xe2, 0x82, 0xac], -1],
  [[0xf0, 0x80, 0x80, 0x80], 0],
  [[0xf0, 0x90, 0x80, 0x80], -1],
  [[0xf4, 0x8f, 0xbf, 0xbf], -1],
  [[0xf4, 0x90, 0x80, 0x80], 0],
  [[0xf5, 0x80, 0x80, 0x80], 0],
  [[0xff], 0],
  [[0x7b, 0xff, 0x7d], 1],
  [[0x41, 0x42, 0xc3], 2],
  [[0xf0, 0x9f, 0x98], 0],
  [[0xf0, 0x9f, 0x98, 0x80], -1],
  [[0xc3, 0xa9, 0x80], 2],
  [[0xef, 0xbb, 0xbf], -1],
  [[0xed, 0xa0, 0x80, 0x41], 0],
  [[...new TextEncoder().encode("я😀")], -1],
];

const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
function strict(bytes) {
  try {
    decoder.decode(bytes);
    return true;
  } catch {
    return false;
  }
}

test("PK-P4: firstInvalidUtf8 gives the table of 33 sequences and agrees with a strict decoder on 20000 random ones with a fixed seed; the part before the answer is whole UTF-8", () => {
  assert.ok(TABLE.length >= 30);
  for (const [list, want] of TABLE) {
    const bytes = Uint8Array.from(list);
    assert.equal(
      firstInvalidUtf8(bytes),
      want,
      list.map((b) => b.toString(16)).join(" "),
    );
    assert.equal(strict(bytes), want === -1);
  }
  const pool = [
    0x00, 0x41, 0x7f, 0x80, 0x8f, 0x90, 0x9f, 0xa0, 0xbf, 0xc0, 0xc1, 0xc2,
    0xdf, 0xe0, 0xe1, 0xec, 0xed, 0xee, 0xef, 0xf0, 0xf1, 0xf3, 0xf4, 0xf5,
    0xff,
  ];
  const rng = makeRng(2026);
  let good = 0;
  for (let i = 0; i < 20000; i++) {
    const bytes = new Uint8Array(1 + rng.int(8));
    for (let k = 0; k < bytes.length; k++) bytes[k] = rng.pick(pool);
    const at = firstInvalidUtf8(bytes);
    assert.equal(at === -1, strict(bytes), Array.from(bytes).join(","));
    if (at === -1) good += 1;
    else {
      assert.ok(at >= 0 && at < bytes.length);
      assert.equal(
        strict(bytes.subarray(0, at)),
        true,
        `the part before ${at}`,
      );
    }
  }
  assert.ok(good > 100 && good < 19000, `${good} good sequences`);
});

// ---------------------------------------------------------------------- PK-P5

test("PK-P5: a BOM at the start is dropped and not counted - the text is the same, every place of a failure stays", () => {
  const bom = Uint8Array.from([0xef, 0xbb, 0xbf]);
  const withBom = (bytes) => Uint8Array.from([...bom, ...bytes]);
  assert.deepEqual(decodeTenantBytes(bom), { ok: true, text: "" });
  assert.deepEqual(decodeTenantBytes(withBom(new TextEncoder().encode("{}"))), {
    ok: true,
    text: "{}",
  });
  assert.deepEqual(decodeTenantBytes(Uint8Array.from([0xef, 0xbb])).ok, false);
  // a second BOM is a sign of the text, not dropped: the reader refuses it
  const twice = checkBytes(
    withBom(withBom(new TextEncoder().encode("{}"))),
    "x.json",
  );
  assert.equal(twice.exitCode, 1);
  for (const name of [
    "ok-minimal.json",
    "e-five-errors.json",
    "e-sort-order.json",
    "e-json-syntax.txt",
    "e-json-truncated.txt",
    "e-json-dup-key.txt",
    "e-json-utf8.txt",
    "e-json-empty.txt",
  ]) {
    const plain = checkBytes(fixtureBytes(name), name);
    const marked = checkBytes(withBom(fixtureBytes(name)), name);
    assert.deepEqual(marked, plain, name);
  }
  const bad = decodeTenantBytes(withBom(fixtureBytes("e-json-utf8.txt")));
  assert.deepEqual(bad, { ok: false, line: 2, column: 12 });
  assert.deepEqual(decodeTenantBytes(fixtureBytes("e-json-utf8.txt")), bad);
});

// ---------------------------------------------------------------------- PK-P6

test("PK-P6: the rule of text - phrases, words, the form 'вы' and the length in code points", () => {
  const phrases = (text) => phrasesOf(text).filter((p) => p.trim() !== "");
  assert.deepEqual(phrases("Один. Два!"), ["Один.", "Два!"]);
  assert.deepEqual(phrases("Что? Как… Так"), ["Что?", "Как…", "Так"]);
  assert.deepEqual(phrases("Цена 1.5 рубля"), ["Цена 1.5 рубля"]);
  assert.deepEqual(phrases("а.б"), ["а.б"]);
  assert.deepEqual(phrases("а. б"), ["а.", "б"]);
  assert.deepEqual(phrases("а.\nб"), ["а.", "б"]);
  assert.deepEqual(phrases("а.\tб"), ["а.", "б"]);
  assert.deepEqual(phrases("а.  б"), ["а.", "б"]);
  assert.deepEqual(phrases("без знака"), ["без знака"]);
  const words = [
    ["раз два", 2],
    ["раз — два", 2],
    ["—", 0],
    ["1.5", 1],
    ["", 0],
    ["a-b c", 2],
    ["  раз   два  ", 2],
    ["😀", 0],
    ["раз-два", 1],
    ["a\tb\nc", 3],
  ];
  for (const [text, n] of words)
    assert.equal(wordCount(text), n, JSON.stringify(text));
  const long19 = { kind: "long", words: 19 };
  assert.deepEqual(textProblem(raz(19)), long19);
  assert.equal(textProblem(raz(18)), null);
  assert.deepEqual(textProblem(`${raz(18)} — — — — —`), null);
  assert.deepEqual(textProblem(`${raz(5)} 1.5 ${raz(13)}`), long19);
  assert.equal(textProblem(`${raz(10)}. ${raz(10)}. ${raz(10)}.`), null);
  assert.deepEqual(textProblem(`Коротко. ${raz(19)}`), long19);
  assert.deepEqual(textProblem(`${raz(19)}… Коротко`), long19);
  // a dot with no space after it cuts nothing: "раз.раз" is one word, 19 in all
  assert.deepEqual(textProblem(`${raz(10)}.${raz(10)}`), long19);
  for (const text of [
    "Ты тут",
    "ТЫ",
    "тебя",
    "Тебе, нужно.",
    "Это твоё",
    "ТВОИ дела",
    "Твой выбор",
    "Мы с тобой",
    "это твоя вещь",
    "Ты-то",
  ]) {
    assert.deepEqual(textProblem(text), { kind: "formal" }, text);
  }
  assert.deepEqual(
    textProblem(`${raz(19)} ты`),
    { kind: "formal" },
    "the address first",
  );
  for (const text of [
    "Цветы и тыква",
    "Фрукты",
    "Мы — вы",
    "вы получите",
    "тыквы",
    "стыд",
    "Брюки",
  ]) {
    assert.equal(textProblem(text), null, text);
  }
  const lengths = [
    ["  я  ", 1],
    ["😀я", 2],
    ["", 0],
    ["   ", 0],
    ["é", 2],
    ["\n яя \t", 2],
    ["😀".repeat(50), 50],
  ];
  for (const [text, n] of lengths)
    assert.equal(trimmedLength(text), n, JSON.stringify(text));
});
