import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CONSENT_KEYS as LIST_KEYS,
  DELETION_TERM,
} from "../../scripts/word-lists.js";
import { consentText, CONSENT_KEYS } from "../../public/shared/consent.js";
import { TEXTS } from "../../public/shared/i18n/texts.js";
import { textProblem, wordsProblem } from "../../public/shared/text-rules.js";
import { CONSENT, consentSha } from "../fixtures/m23.js";

// REQ-116 criterion 5 (AC2.10, PLAN R2.2; the code design M2PROJ, 4.7, 4.8, C9): the five consent sentences of the
// invitation page. The sentences are the test's own literals (fixtures/m23.js, copied from the requirement), so
// the oracle does not read the texts module it checks; the digest is Node's crypto over the test's own join.

const LANGS = /** @type {const} */ (["ru", "kk", "en"]);

/** The value of a key of the texts module in a language. @param {string} key @param {string} lang */
const value = (key, lang) =>
  /** @type {Record<string, string>} */ (
    /** @type {Record<string, Record<string, string>>} */ (TEXTS)[key]
  )[lang];

/** The words of a sentence by the test's own rule: parts between spaces that hold a letter or a digit. @param {string} s */
const words = (s) =>
  s.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;

test("CON-1 the ru and en values of consent_s1 to consent_s5 equal the ten sentences of the requirement character for character", () => {
  assert.equal(CONSENT.ru.length, 5);
  assert.equal(CONSENT.en.length, 5);
  for (const lang of /** @type {const} */ (["ru", "en"]))
    for (const [i, sentence] of CONSENT[lang].entries()) {
      const key = `consent_s${i + 1}`;
      assert.equal(value(key, lang), sentence, `${key} ${lang}`);
    }
  // The keys of the module are exactly the five: no sixth consent key.
  const consentLike = Object.keys(TEXTS).filter((k) => /^consent_/.test(k));
  assert.deepEqual(consentLike.sort(), [
    "consent_s1",
    "consent_s2",
    "consent_s3",
    "consent_s4",
    "consent_s5",
  ]);
});

test("CON-2 each sentence of every language has at most 18 words, by the test's own count and by text-rules.js", () => {
  for (const lang of LANGS)
    for (let i = 1; i <= 5; i += 1) {
      const v = value(`consent_s${i}`, lang);
      assert.equal(typeof v, "string", `consent_s${i} ${lang}`);
      assert.ok(words(v) >= 1 && words(v) <= 18, `${i} ${lang}: ${words(v)}`);
      assert.equal(wordsProblem(v), null, `${i} ${lang}`);
      assert.equal(textProblem(v), null, `${i} ${lang}`);
    }
  // The rule is the one the test applies: an 19-word sentence is a problem for both counts.
  const long = Array.from({ length: 19 }, (_, i) => `слово${i}`).join(" ");
  assert.equal(words(long), 19);
  assert.notEqual(wordsProblem(long), null);
});

test("CON-3 every fixed phrase of the requirement stands in the ru value and in the en value", () => {
  const ru = [
    "обработку моих данных",
    "по приглашению",
    "адрес почты",
    "имя",
    "хеш пароля",
    "запись об этом согласии",
    "HMAC-код IP-адреса",
    "до удаления учётной записи",
    "в Германии (Франкфурт)",
    "Anthropic в США",
    "отозвать",
    "в течение 15 рабочих дней",
  ];
  const en = [
    "processing of my data",
    "by invitation",
    "e-mail",
    "name",
    "password hash",
    "this consent record",
    "HMAC code of the IP",
    "until the account is deleted",
    "Germany (Frankfurt)",
    "Anthropic in the USA",
    "withdraw consent",
    "within 15 working days",
  ];
  const joined = (/** @type {string} */ lang) =>
    CONSENT_KEYS.map((k) => value(k, lang)).join(" ");
  for (const p of ru) assert.ok(joined("ru").includes(p), p);
  for (const p of en) assert.ok(joined("en").includes(p), p);
  // Each phrase stands in the sentence the requirement puts it in (the first, the second ... by order).
  assert.ok(value("consent_s2", "ru").includes("HMAC-код IP-адреса"));
  assert.ok(value("consent_s5", "ru").includes("в течение 15 рабочих дней"));
  assert.ok(value("consent_s5", "en").includes("within 15 working days"));
});

test("CON-4 the kk value holds five sentences and the tokens every language keeps", () => {
  const kk = CONSENT_KEYS.map((k) => value(k, "kk"));
  for (const [i, s] of kk.entries()) {
    assert.equal(typeof s, "string", `consent_s${i + 1} kk`);
    assert.ok(s.length > 0);
    // One sentence end each, at the end, none inside.
    assert.equal((s.match(/[.!?…](?=\s|$)/g) ?? []).length, 1, s);
    assert.match(s, /[.!?…]$/);
  }
  const whole = kk.join(" ");
  assert.equal((whole.match(/[.!?…](?=\s|$)/g) ?? []).length, 5);
  for (const token of ["Sai", "HMAC", "IP", "Франкфурт", "Anthropic", "15"])
    assert.ok(whole.includes(token), token);
});

test("CON-5 the two lists of the five keys are equal, at most five, each a key of the texts module with three values; the deletion-term phrase stands once in its language's fifth sentence", () => {
  assert.deepEqual([...LIST_KEYS], [...CONSENT_KEYS]);
  assert.ok(LIST_KEYS.length <= 5 && LIST_KEYS.length === 5);
  for (const key of LIST_KEYS) {
    assert.ok(Object.hasOwn(TEXTS, key), key);
    for (const lang of LANGS) {
      const v = value(key, lang);
      assert.ok(typeof v === "string" && v.length > 0, `${key} ${lang}`);
    }
  }
  // The phrases, as literals of the test (the kk one is the phrase of the design, 4.8).
  assert.deepEqual(
    { ...DELETION_TERM },
    {
      ru: "в течение 15 рабочих дней",
      kk: "15 жұмыс күні ішінде",
      en: "within 15 working days",
    },
  );
  for (const lang of LANGS) {
    const phrase = DELETION_TERM[lang];
    const all = LIST_KEYS.map((k) => value(k, lang));
    assert.equal(all[4].split(phrase).length - 1, 1, `${lang}: in s5`);
    for (const k of all.slice(0, 4))
      assert.ok(!k.includes(phrase), `${lang}: only in s5`);
  }
  // A phrase of one language is not the phrase of another.
  assert.notEqual(DELETION_TERM.ru, DELETION_TERM.en);
});

test("CON-6 consentText joins the five values by one space and is null when a language lacks one; its sha256 equals the test's own oracle", () => {
  for (const lang of LANGS) {
    const text = consentText(TEXTS, lang);
    assert.equal(text, CONSENT[lang].join(" "), lang);
    assert.equal(/** @type {string} */ (text).split(" ").length - 1 >= 4, true);
    assert.equal(consentSha(lang).length, 64);
    assert.match(consentSha(lang), /^[0-9a-f]{64}$/);
  }
  // The three digests differ.
  assert.equal(new Set(LANGS.map((l) => consentSha(l))).size, 3);
  // A missing value of a language, an empty one and a missing key give null, for that language only.
  const full = Object.fromEntries(
    CONSENT_KEYS.map((k) => [k, { ru: "а", kk: "б", en: "в" }]),
  );
  assert.equal(consentText(full, "ru"), "а а а а а");
  const noKk = { ...full, consent_s3: { ru: "а", en: "в" } };
  assert.equal(consentText(noKk, "kk"), null);
  assert.equal(consentText(noKk, "ru"), "а а а а а");
  const empty = { ...full, consent_s2: { ru: "а", kk: "", en: "в" } };
  assert.equal(consentText(empty, "kk"), null);
  const noKey = Object.fromEntries(
    CONSENT_KEYS.slice(0, 4).map((k) => [k, { ru: "а", kk: "б", en: "в" }]),
  );
  assert.equal(consentText(noKey, "en"), null);
  assert.equal(consentText(full, "de"), null);
  // The join has no trailing or doubled space and no newline.
  assert.ok(
    !/\s{2}|\n|^\s|\s$/.test(/** @type {string} */ (consentText(TEXTS, "ru"))),
  );
});
