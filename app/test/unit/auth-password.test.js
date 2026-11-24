import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import * as listModule from "../../server/auth/common-passwords.js";
import { DUMMY_HASH, hash, rules, verify } from "../../server/auth/password.js";
import { blank } from "../fixtures/blank.js";
import { APP } from "../fixtures/helpers.js";

// REQ-114 criterion 1 (the code design M2AUTH, 4.9.2; decisions/0137 N2a, N2b and Addition 2): the stored form
// of a password hash, the full-key compare, the length rule in code points and the bundled common-password
// list. The oracle is the test's own: the key is derived again here with node:crypto scrypt at N = 2^17,
// r = 8, p = 1, and the list module's rules are checked on its text and its export.

const FORM = /^scrypt\$17\$8\$1\$([A-Za-z0-9_-]+)\$([A-Za-z0-9_-]+)$/;
const LIST_FILE = path.join(APP, "server", "auth", "common-passwords.js");
const PASSWORD_FILE = path.join(APP, "server", "auth", "password.js");

/** scrypt as REQ-114 fixes it: N = 2^17, r = 8, p = 1, a 64-byte key, the NFC form of the password. */
const scrypt = (/** @type {string} */ pw, /** @type {Buffer} */ salt) =>
  /** @type {Promise<Buffer>} */ (
    new Promise((resolve, reject) =>
      crypto.scrypt(
        Buffer.from(pw.normalize("NFC"), "utf8"),
        salt,
        64,
        { N: 2 ** 17, r: 8, p: 1, maxmem: 160 * 1024 * 1024 },
        (err, key) => (err ? reject(err) : resolve(key)),
      ),
    )
  );

/** A seeded generator (mulberry32), so a case list is the same on every run. */
function seeded(/** @type {number} */ seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = a;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/** A text of `n` code points drawn from `alphabet` (an array of code points as strings). */
const textOf = (
  /** @type {() => number} */ rnd,
  /** @type {string[]} */ alphabet,
  /** @type {number} */ n,
) =>
  Array.from(
    { length: n },
    () => alphabet[Math.floor(rnd() * alphabet.length)],
  ).join("");

const ASCII = [
  ..."abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789-_.!",
];
const ASTRAL = ["😀", "𝔸", "𠀋", "🜁"];
const CYRILLIC = [..."абвгдежзийклмнопрстуфхцчшщэюя"];

test("PW-1 a hash has the form scrypt$17$8$1$<salt>$<hash> with a 16-byte salt and a 64-byte key, the key is scrypt at N = 2^17, r = 8, p = 1, and DUMMY_HASH has the same form", async () => {
  const pw = "a long passphrase for PW-1 Ж";
  const a = await hash(pw);
  const b = await hash(pw);
  for (const h of [a, b]) {
    const m = FORM.exec(h);
    assert.ok(m, h);
    const salt = Buffer.from(m[1], "base64url");
    const key = Buffer.from(m[2], "base64url");
    assert.equal(salt.length, 16);
    assert.equal(key.length, 64);
    assert.equal(salt.toString("base64url"), m[1]);
    assert.equal(key.toString("base64url"), m[2]);
    // The key is the scrypt of the NFC form of the password with these parameters (not only the label «17»).
    assert.ok((await scrypt(pw, salt)).equals(key), "scrypt N = 2^17");
  }
  assert.notEqual(a, b, "a random salt per hash");
  const d = FORM.exec(DUMMY_HASH);
  assert.ok(d, "DUMMY_HASH has the form");
  assert.equal(Buffer.from(d[1], "base64url").length, 16);
  assert.equal(Buffer.from(d[2], "base64url").length, 64);
  // The NFD form of a password verifies against the hash of its NFC form (the password is normalised).
  const nfc = "pässwörd-über-1";
  assert.ok(await verify(nfc.normalize("NFD"), await hash(nfc)));
});

test("PW-2 the right password verifies; a password that differs in the first or in the last character does not; a stored text of another form never verifies", async () => {
  const rnd = seeded(114001);
  for (const alphabet of [ASCII, CYRILLIC, ASTRAL]) {
    const pw = textOf(rnd, alphabet, 14);
    const stored = await hash(pw);
    assert.equal(await verify(pw, stored), true, "the right password");
    const cps = [...pw];
    const other = (/** @type {string} */ c) =>
      c === alphabet[0] ? alphabet[1] : alphabet[0];
    const first = [other(cps[0]), ...cps.slice(1)].join("");
    const last = [...cps.slice(0, -1), other(cps[cps.length - 1])].join("");
    assert.equal(await verify(first, stored), false, "first character");
    assert.equal(await verify(last, stored), false, "last character");
  }
  const stored = await hash("another-long-pass-2");
  for (const bad of [
    stored.replace("scrypt$17$", "scrypt$15$"),
    stored.replace("$8$1$", "$8$2$"),
    stored.slice(0, -1),
    `${stored}A`,
    "",
    "plain-text-password",
  ])
    assert.equal(
      await verify("another-long-pass-2", bad),
      false,
      bad.slice(0, 20),
    );
});

test("PW-2b the right password against a stored hash whose last (or first) key byte is changed → false (the full 64 bytes are compared)", async () => {
  const pw = "full-key-compare-pass";
  const stored = await hash(pw);
  const m = /** @type {RegExpExecArray} */ (FORM.exec(stored));
  const key = Buffer.from(m[2], "base64url");
  for (const at of [63, 32, 0]) {
    const changed = Buffer.from(key);
    changed[at] ^= 0x01;
    const text = `scrypt$17$8$1$${m[1]}$${changed.toString("base64url")}`;
    assert.equal(await verify(pw, text), false, `key byte ${at} changed`);
  }
  assert.equal(await verify(pw, stored), true);
});

test("PW-3 lengths 9 and 129 code points → password_rules, 10 and 128 → ok, for ASCII, Cyrillic and astral characters", () => {
  const rnd = seeded(114003);
  for (const alphabet of [ASCII, CYRILLIC, ASTRAL]) {
    for (const [n, want] of /** @type {Array<[number, string]>} */ ([
      [0, "password_rules"],
      [1, "password_rules"],
      [9, "password_rules"],
      [10, "ok"],
      [11, "ok"],
      [64, "ok"],
      [127, "ok"],
      [128, "ok"],
      [129, "password_rules"],
      [400, "password_rules"],
    ])) {
      const pw = textOf(rnd, alphabet, n);
      assert.equal([...pw].length, n);
      assert.equal(rules(pw), want, `${n} code points of ${alphabet[0]}…`);
    }
  }
});

/** The full permission notice of the MIT License (the text of SecLists' LICENSE, F31). */
const MIT_NOTICE = [
  "MIT License",
  "Copyright (c) 2018 Daniel Miessler",
  'Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:',
  "The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.",
  'THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.',
];

test("PW-4 a password of the bundled list, also in upper case, → password_rules and a long random one → ok; the module's header, its one frozen export and its entries", () => {
  const src = fs.readFileSync(LIST_FILE, "utf8");
  // The header block comment: the source file, the commit and the full MIT licence text (R2).
  const header = /^\/\*([\s\S]*?)\*\//.exec(src);
  assert.ok(header, "the module starts with a block comment");
  const words = header[1]
    .split("\n")
    .map((l) => l.replace(/^\s*\*\s?/, "").trim())
    .join(" ")
    .replace(/\s+/g, " ");
  assert.ok(words.includes("SecLists"), "the source");
  assert.ok(
    words.includes(
      "Passwords/Common-Credentials/xato-net-10-million-passwords-100000.txt",
    ),
    "the source file",
  );
  assert.match(words, /\bcommit [0-9a-f]{40}\b/, "the commit");
  for (const part of MIT_NOTICE)
    assert.ok(words.includes(part), part.slice(0, 40));
  // Exactly one export, frozen; every entry 10-128 code points, lower case, printable ASCII without
  // " ' \, unique and sorted by code unit.
  assert.deepEqual(Object.keys(listModule), ["COMMON_PASSWORDS"]);
  const list = listModule.COMMON_PASSWORDS;
  assert.ok(Array.isArray(list) && Object.isFrozen(list));
  assert.ok(list.length > 1000, `${list.length} entries`);
  const code = blank(src, true);
  assert.equal([...code.matchAll(/\bexport\b/g)].length, 1, "one export");
  for (let i = 0; i < list.length; i++) {
    const e = /** @type {string} */ (list[i]);
    assert.equal(typeof e, "string");
    const n = [...e].length;
    assert.ok(n >= 10 && n <= 128, e);
    assert.equal(e, e.toLowerCase(), e);
    assert.match(e, /^[ -~]+$/, e);
    assert.doesNotMatch(e, /["'\\]/, e);
    if (i > 0) assert.ok(list[i - 1] < e, `sorted and unique at ${i}: ${e}`);
  }
  // The rule: entries spread over the whole list (a fixed seed), as they are, in upper case and in mixed
  // case, are refused; a long random password and a near miss of an entry are accepted.
  const rnd = seeded(114004);
  const picks = [list[0], list[list.length - 1]];
  for (let i = 0; i < 40; i++)
    picks.push(list[Math.floor(rnd() * list.length)]);
  for (const e of picks) {
    assert.equal(rules(e), "password_rules", e);
    assert.equal(rules(e.toUpperCase()), "password_rules", e.toUpperCase());
    const mixed = [...e].map((c, j) => (j % 2 ? c.toUpperCase() : c)).join("");
    assert.equal(rules(mixed), "password_rules", mixed);
  }
  const set = new Set(list);
  for (let i = 0; i < 20; i++) {
    const random = crypto.randomBytes(18).toString("base64url");
    assert.ok(!set.has(random.toLowerCase()));
    assert.equal(rules(random), "ok", random);
  }
  const near = `${list[0]}!x`;
  if (!set.has(near.toLowerCase())) assert.equal(rules(near), "ok");
  // The list is a module imported by password.js; no file is read at run time and no .txt lies under server/.
  const pwSrc = blank(fs.readFileSync(PASSWORD_FILE, "utf8"), true);
  assert.match(pwSrc, /from\s+"\.\/common-passwords\.js"/);
  assert.doesNotMatch(pwSrc, /node:fs|readFile/);
  /** @param {string} dir @returns {string[]} */
  const walk = (dir) =>
    fs
      .readdirSync(dir, { withFileTypes: true })
      .flatMap((d) =>
        d.isDirectory()
          ? walk(path.join(dir, d.name))
          : [path.join(dir, d.name)],
      );
  assert.deepEqual(
    walk(path.join(APP, "server")).filter((f) => f.endsWith(".txt")),
    [],
  );
});
