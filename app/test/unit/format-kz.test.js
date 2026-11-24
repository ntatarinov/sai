import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import {
  formatDate,
  formatDateTime,
  formatNumber,
  formatTime,
} from "../../public/shared/format/kz.js";
import { APP, childEnv } from "../fixtures/helpers.js";

// REQ-117 criterion 7 (the Kazakhstan formats; the code design M2PROJ, 4.7): app/public/shared/format/kz.js
// against a literal table, against an independent calendar oracle written here (whole days and year lengths,
// no Date), in child processes of other time zones, on refused inputs and by the greps of the criterion, which
// the test runs itself on the module's text.

const KZ = path.join(APP, "public", "shared", "format", "kz.js");
const NNBSP = " ";

test("KZ-1 a literal table of at least 16 rows: the four numbers and the seven date-times of the criterion, and more at the edges of days, months and leap years", () => {
  /** @type {Array<[string, string, string]>} label, got, want */
  const rows = [
    ["number 0", formatNumber(0), "0"],
    ["number 7", formatNumber(7), "7"],
    ["number 999", formatNumber(999), "999"],
    ["number 1000", formatNumber(1000), `1${NNBSP}000`],
    ["number 12345", formatNumber(12345), `12${NNBSP}345`],
    ["number 1250000", formatNumber(1250000), `1${NNBSP}250${NNBSP}000`],
    [
      "the largest safe integer",
      formatNumber(Number.MAX_SAFE_INTEGER),
      `9${NNBSP}007${NNBSP}199${NNBSP}254${NNBSP}740${NNBSP}991`,
    ],
    [
      "27.10.2026 18:53",
      formatDateTime(Date.UTC(2026, 9, 27, 13, 53, 0)),
      "27.10.2026, 18:53",
    ],
    [
      "UTC evening is the next day in Astana",
      formatDateTime(Date.UTC(2026, 9, 26, 20, 0, 0)),
      "27.10.2026, 01:00",
    ],
    [
      "UTC midnight is 05:00",
      formatDateTime(Date.UTC(2026, 9, 26, 0, 0, 0)),
      "26.10.2026, 05:00",
    ],
    [
      "the new year",
      formatDateTime(Date.UTC(2026, 11, 31, 19, 0, 0)),
      "01.01.2027, 00:00",
    ],
    [
      "29 February 2028",
      formatDateTime(Date.UTC(2028, 1, 28, 19, 0, 0)),
      "29.02.2028, 00:00",
    ],
    [
      "1 March 2027 (no leap day)",
      formatDateTime(Date.UTC(2027, 1, 28, 19, 0, 0)),
      "01.03.2027, 00:00",
    ],
    ["time 0", formatDateTime(0), "01.01.1970, 05:00"],
    [
      "29 February 2000 (a leap century)",
      formatDateTime(Date.UTC(2000, 1, 28, 19, 0, 0)),
      "29.02.2000, 00:00",
    ],
    [
      "1 March 2100 (not a leap century)",
      formatDateTime(Date.UTC(2100, 1, 28, 19, 0, 0)),
      "01.03.2100, 00:00",
    ],
    [
      "before 1970",
      formatDateTime(Date.UTC(1969, 11, 31, 19, 0, 0)),
      "01.01.1970, 00:00",
    ],
    [
      "one millisecond before 1970 UTC",
      formatDateTime(-1),
      "01.01.1970, 04:59",
    ],
    [
      "the minute is cut, not rounded",
      formatDateTime(Date.UTC(2026, 9, 27, 13, 53, 59, 999)),
      "27.10.2026, 18:53",
    ],
    ["date alone", formatDate(Date.UTC(2026, 9, 27, 13, 53, 0)), "27.10.2026"],
    ["time alone", formatTime(Date.UTC(2026, 9, 27, 13, 53, 0)), "18:53"],
  ];
  assert.ok(rows.length >= 16, `${rows.length} rows`);
  for (const [label, got, want] of rows) assert.equal(got, want, label);
});

/**
 * A seeded generator (a linear congruential step of 32 bits; the seed fixes the whole run).
 * @param {number} seed
 */
function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** @param {number} y */
const leap = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
/** @param {number} y */
const yearDays = (y) => (leap(y) ? 366 : 365);
/** @param {number} y @param {number} m 1 to 12 */
const monthDays = (y, m) =>
  [31, leap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];

/**
 * The date-time text of a moment by counting whole years and months from 1970, with no Date and not the
 * algorithm of the module: Astana time is UTC+5 all year.
 * @param {number} ms
 */
function oracle(ms) {
  const local = ms + 5 * 3_600_000;
  let days = Math.floor(local / 86_400_000);
  const minutes = Math.floor((local - days * 86_400_000) / 60_000);
  let year = 1970;
  while (days < 0) {
    year -= 1;
    days += yearDays(year);
  }
  while (days >= yearDays(year)) {
    days -= yearDays(year);
    year += 1;
  }
  let month = 1;
  while (days >= monthDays(year, month)) {
    days -= monthDays(year, month);
    month += 1;
  }
  const two = (/** @type {number} */ n) => String(n).padStart(2, "0");
  return `${two(days + 1)}.${two(month)}.${String(year).padStart(4, "0")}, ${two(Math.floor(minutes / 60))}:${two(minutes % 60)}`;
}

test("KZ-2 an independent oracle (whole years and months, no Date) agrees for 5 000 seeded moments from 31 years before 1970 to 2128, and for every day edge of three leap and non-leap years", () => {
  const rand = seeded(20261124);
  const from = Date.UTC(1939, 0, 1);
  const to = Date.UTC(2128, 0, 1);
  for (let i = 0; i < 5000; i += 1) {
    const ms = Math.floor(from + rand() * (to - from));
    assert.equal(formatDateTime(ms), oracle(ms), `moment ${ms}`);
  }
  // Every midnight of Astana time in 2027 (not leap), 2028 (leap) and 2100 (a century that is not): the day
  // before it by one minute and the minute itself.
  for (const year of [2027, 2028, 2100]) {
    let day = Date.UTC(year, 0, 1) - 5 * 3_600_000;
    for (let d = 0; d < yearDays(year); d += 1) {
      for (const ms of [day - 60_000, day])
        assert.equal(formatDateTime(ms), oracle(ms), `moment ${ms}`);
      day += 86_400_000;
    }
  }
});

test("KZ-3 child processes of three other time zones print the same strings as this process", () => {
  const moments = [
    0,
    Date.UTC(2026, 9, 27, 13, 53, 0),
    Date.UTC(2028, 1, 28, 19, 0, 0),
    -1,
  ];
  const code = `import(${JSON.stringify(pathToFileURL(KZ).href)}).then((m) => { console.log(JSON.stringify(${JSON.stringify(moments)}.map((x) => m.formatDateTime(x)).concat([m.formatNumber(1250000)]))); });`;
  const here = JSON.stringify([
    ...moments.map((x) => formatDateTime(x)),
    formatNumber(1250000),
  ]);
  for (const tz of ["America/New_York", "Asia/Almaty", "Pacific/Kiritimati"]) {
    const r = spawnSync(process.execPath, ["--input-type=module", "-e", code], {
      env: childEnv({ TZ: tz }),
      encoding: "utf8",
    });
    assert.equal(r.status, 0, `${tz}: ${r.stderr}`);
    assert.equal(r.stdout.trim(), here, tz);
  }
});

test("KZ-4 a number that is not a non-negative safe integer and a time that is not a finite number throw an Error", () => {
  const bad = [
    -1,
    1.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    "5",
    null,
    undefined,
    2 ** 53,
  ];
  for (const x of bad)
    assert.throws(
      () => formatNumber(/** @type {any} */ (x)),
      Error,
      `number ${String(x)}`,
    );
  const badTimes = [
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    "5",
    null,
    undefined,
    {},
  ];
  for (const x of badTimes)
    for (const f of [formatDate, formatTime, formatDateTime])
      assert.throws(
        () => f(/** @type {any} */ (x)),
        Error,
        `${f.name}(${String(x)})`,
      );
});

/**
 * The lines of a text that a pattern hits, as `<line>:<text>` like `grep -n`.
 * @param {string} text
 * @param {RegExp} re
 * @returns {string[]}
 */
const hits = (text, re) =>
  text
    .split("\n")
    .map((l, i) => (re.test(l) ? `${i + 1}:${l}` : null))
    .filter((x) => x !== null)
    .map(String);

// The three greps of the criterion, as regular expressions: -w is a word match for the first (the words are all
// word characters, so \b on both sides is the same rule).
const WORDS = /\b(import|require|process|Intl|getTimezoneOffset)\b/;
const FORBIDDEN = /node:|fetch[(]|Math[.]random|Date[.]now/;
const LOCALE = /(^|[^A-Za-z0-9_$])toLocale[A-Za-z]*/;

test("KZ-5 the three greps of the criterion print nothing on kz.js (comments included); the first finds a planted `const p = process.env` and not `processed`; the other two find their planted forms", () => {
  const text = fs.readFileSync(KZ, "utf8");
  assert.deepEqual(hits(text, WORDS), []);
  assert.deepEqual(hits(text, FORBIDDEN), []);
  assert.deepEqual(hits(text, LOCALE), []);
  // The self-check of the criterion: a word match finds `process` and does not find `processed`.
  assert.equal(hits("const p = process.env", WORDS).length, 1);
  assert.equal(hits("const processed = 1", WORDS).length, 0);
  assert.equal(hits("x.getTimezoneOffset()", WORDS).length, 1);
  assert.equal(hits("new Intl.DateTimeFormat()", WORDS).length, 1);
  assert.equal(hits('import fs from "fs"', WORDS).length, 1);
  for (const planted of [
    "import x from 'node:fs'",
    "fetch(url)",
    "Math.random()",
    "Date.now()",
  ])
    assert.equal(hits(planted, FORBIDDEN).length, 1, planted);
  for (const planted of [
    "d.toLocaleString()",
    "x.toLocaleDateString('ru')",
    "toLocaleTimeString",
  ])
    assert.equal(hits(planted, LOCALE).length, 1, planted);
  assert.equal(hits("const myToLocaleX = 1", LOCALE).length, 0);
});

/**
 * The `.js` files directly under a folder of app/public/js.
 * @param {string} rel
 */
const scripts = (rel) =>
  fs
    .readdirSync(path.join(APP, "public", "js", rel))
    .filter((f) => f.endsWith(".js"))
    .map((f) => `public/js/${rel}/${f}`);

test("KZ-6 no script of app/public/js/pages and app/public/js/admin holds toLocale, Intl or getTimezoneOffset; a page script that formats a date or a number imports the formatter from kz.js", () => {
  const files = [...scripts("pages"), ...scripts("admin")];
  assert.ok(files.length >= 15, files.join(", "));
  const word = /\btoLocale\w*|\bIntl\b|\bgetTimezoneOffset\b/;
  // public/js/pages/demo.js is the script of an M1 page that M2 must not change (M2P-4 pins its sha256); its one
  // comment names the word «Intl» («with no Intl»), so the grep of the criterion, read over the whole folder,
  // would find it. It is left out of the scan, and the test checks that its only hits are comment lines.
  const M1_SCRIPT = "public/js/pages/demo.js";
  const demoHits = hits(
    fs.readFileSync(path.join(APP, M1_SCRIPT), "utf8"),
    word,
  );
  assert.ok(
    demoHits.every((h) => /^\d+:\s*(\*|\/\/)/.test(h)),
    `demo.js: a hit outside a comment: ${demoHits.join(" | ")}`,
  );
  /** @type {string[]} */
  const found = [];
  for (const f of files.filter((x) => x !== M1_SCRIPT)) {
    const text = fs.readFileSync(path.join(APP, f), "utf8");
    for (const line of hits(text, word)) found.push(`${f}:${line}`);
    // A formatter name used in the script is imported from the one module.
    for (const name of [
      "formatNumber",
      "formatDate",
      "formatTime",
      "formatDateTime",
    ]) {
      if (!new RegExp(`\\b${name}\\s*\\(`).test(text)) continue;
      const imported = new RegExp(
        `import\\s*\\{[^}]*\\b${name}\\b[^}]*\\}\\s*from\\s*["']\\.\\./\\.\\./shared/format/kz\\.js["']`,
      ).test(text);
      if (!imported)
        found.push(`${f}: ${name} is used and not imported from kz.js`);
    }
  }
  assert.deepEqual(found, []);
  // Self-check of the word rule.
  assert.ok(word.test("d.toLocaleString('ru')"));
  assert.ok(word.test("new Intl.NumberFormat()"));
  assert.ok(!word.test("const international = 1"));
});
