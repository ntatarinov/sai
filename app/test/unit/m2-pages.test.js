import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { STAGES } from "../../public/shared/project/stages.js";
import { TEXTS } from "../../public/shared/i18n/texts.js";
import { blank } from "../fixtures/blank.js";
import { APP } from "../fixtures/helpers.js";

// REQ-117 criterion 8 (the footer on every M2 page; the code design M2PROJ, 4.8, 4.9 and F21): the closed list of
// the fourteen pages of M2, the footer on each, the consent box that is not ticked and the sentences that the
// HTML does not hold, the sha256 of everything M2 must leave alone (recorded from the base of the run), and the
// scan that finds a text for every key a page shows.

const PUBLIC = path.join(APP, "public");

/** The six pages of M1: no M2 footer, and no byte changed by M2. */
const M1_PAGES = ["404", "demo", "examples", "gate", "how", "index"];
/** The fourteen pages of M2: the four account pages of REQ-114 and the ten of REQ-116 and REQ-117, with their scripts. */
const M2_PAGES = /** @type {Record<string, string>} */ ({
  account: "js/pages/account.js",
  admin: "js/admin/admin.js",
  "admin-audit": "js/admin/admin-audit.js",
  "admin-deletions": "js/admin/admin-deletions.js",
  "admin-invites": "js/admin/admin-invites.js",
  "admin-request": "js/admin/admin-request.js",
  "admin-totp": "js/pages/admin-totp.js",
  invite: "js/pages/invite.js",
  login: "js/pages/login.js",
  "project-new": "js/pages/project-new.js",
  project: "js/pages/project.js",
  projects: "js/pages/projects.js",
  reset: "js/pages/reset.js",
  setup: "js/pages/setup.js",
});

const FOOTER = {
  ru: "Закрытый тест. Данные хранятся за рубежом (Германия, Франкфурт); тексты для ИИ обрабатывает Anthropic (за рубежом).",
  en: "Closed test. Data is stored abroad (Germany, Frankfurt); texts for the AI are processed by Anthropic (abroad).",
};

/** @param {string} rel */
const read = (rel) => fs.readFileSync(path.join(PUBLIC, rel), "utf8");
/** The text with every run of white space as one space and the ends trimmed. @param {string} s */
const flat = (s) => s.replace(/\s+/g, " ").trim();

/**
 * The element with an id: its start tag text and its inner HTML up to the first closing tag of its name (the
 * elements read here do not nest their own name). Null when there is none.
 * @param {string} html
 * @param {string} id
 * @returns {{ tag: string, inner: string, start: number, end: number } | null}
 */
function elementById(html, id) {
  const m = new RegExp(
    `<([A-Za-z][A-Za-z0-9]*)\\b[^>]*\\bid="${id}"[^>]*>`,
  ).exec(html);
  if (!m) return null;
  const from = m.index + m[0].length;
  // A void element (the checkbox) has no inner HTML.
  if (/^(input|br|img|hr|meta|link)$/i.test(m[1]))
    return { tag: m[0], inner: "", start: m.index, end: from };
  const closing = new RegExp(`</${m[1]}\\s*>`).exec(html.slice(from));
  if (!closing) return null;
  const close = from + closing.index;
  return {
    tag: m[0],
    inner: html.slice(from, close),
    start: m.index,
    end: close,
  };
}

test("M2P-1 the list of the fourteen pages of M2 is closed here: every .html file of app/public outside the six M1 pages is on it, and every page on it exists", () => {
  const files = fs
    .readdirSync(PUBLIC)
    .filter((f) => f.toLowerCase().endsWith(".html"))
    .map((f) => f.replace(/\.html$/i, ""))
    .sort();
  assert.equal(Object.keys(M2_PAGES).length, 14);
  assert.deepEqual(
    files.filter((f) => !M1_PAGES.includes(f)),
    Object.keys(M2_PAGES).sort(),
  );
  for (const f of M1_PAGES) assert.ok(files.includes(f), `${f}.html exists`);
  for (const script of Object.values(M2_PAGES))
    assert.ok(fs.existsSync(path.join(PUBLIC, script)), script);
});

test("M2P-2 each of the fourteen pages holds #m2-footer inside its <footer> with the key m2_footer, the ru text of the key in the HTML, and the ru and en values equal the two sentences of the description", () => {
  assert.equal(TEXTS.m2_footer.ru, FOOTER.ru);
  assert.equal(TEXTS.m2_footer.en, FOOTER.en);
  assert.ok(TEXTS.m2_footer.kk && TEXTS.m2_footer.kk.trim().length > 0);
  for (const name of Object.keys(M2_PAGES)) {
    const html = read(`${name}.html`);
    const el = elementById(html, "m2-footer");
    assert.ok(el, `${name}: no #m2-footer`);
    // Inside the page's <footer>.
    const open = html.indexOf("<footer");
    const close = html.indexOf("</footer>");
    assert.ok(
      open >= 0 && el.start > open && el.end < close,
      `${name}: #m2-footer is not inside <footer>`,
    );
    // The key and the ru text of the key in the HTML (a page with scripts off still shows it).
    const span = /<span[^>]*\bdata-t="m2_footer"[^>]*>([^<]*)<\/span\s*>/.exec(
      el.inner,
    );
    assert.ok(span, `${name}: no span with data-t="m2_footer"`);
    assert.equal(flat(span[1]), FOOTER.ru, `${name}: the ru text in the HTML`);
  }
  // A page of M1 has no such footer.
  for (const name of M1_PAGES)
    assert.equal(
      read(`${name}.html`).includes("m2_footer"),
      false,
      `${name}: an M1 page has no m2_footer`,
    );
});

test("M2P-3 invite.html has no checked attribute on #consent and its five consent elements are empty in the HTML (the sentences come from the texts module)", () => {
  const html = read("invite.html");
  const box = elementById(html, "consent");
  assert.ok(box, "no #consent");
  assert.match(box.tag, /type="checkbox"/);
  assert.doesNotMatch(box.tag, /\bchecked\b/i);
  // Nothing else of the page ticks a box either.
  assert.doesNotMatch(html, /<input[^>]*\bchecked\b/i);
  for (const n of [1, 2, 3, 4, 5]) {
    const el = elementById(html, `consent-${n}`);
    assert.ok(el, `no #consent-${n}`);
    assert.equal(el.inner.trim(), "", `#consent-${n} holds text in the HTML`);
  }
  // No consent sentence stands in the HTML under any other element.
  for (const k of [
    "consent_s1",
    "consent_s2",
    "consent_s3",
    "consent_s4",
    "consent_s5",
  ])
    for (const lang of ["ru", "en", "kk"])
      assert.equal(
        flat(html).includes(flat(/** @type {any} */ (TEXTS)[k][lang])),
        false,
        `${k} ${lang} is in the HTML`,
      );
  // The planted forms the checks above must find (self-check of the readers).
  assert.ok(
    elementById(
      '<input type="checkbox" id="consent" checked />',
      "consent",
    )?.tag.includes("checked"),
  );
  assert.equal(elementById('<p id="consent-1">x</p>', "consent-1")?.inner, "x");
});

// The sha256 of what M2 must leave alone, recorded from the base commit of the run (60b10b7): the six pages of M1,
// the demo's script and the six files of the office.
const BASE_SHA256 = /** @type {Record<string, string>} */ ({
  "404.html":
    "7d80dc5eb15157448916aa15177afb48c8a9eb88b6f5cb2e3cfe4d633ff7cbd9",
  "demo.html":
    "ba61971e8ee154ddd7d4690d3f20737586fdc7c9317da6eb0c522f2fd8e00cd7",
  "examples.html":
    "bbe8cef43d63705f73666734094eedb29fc534c742111f8df32f36598465feac",
  "gate.html":
    "ac889bc15c7c6346acb45b932d021b2a70186d2fe5c286b86b7749792b1a065d",
  "how.html":
    "5178130f45d70fda56cdf274679021a6cdde06dcf4b43620abf8af4b1dfccd96",
  "index.html":
    "19c9b7137cbda9ddc5fa021d6a0a6eb3f2cf687d6e731e97ec47a284dc918f06",
  "js/pages/demo.js":
    "fdbf02eb4000185d73963aeb933428731ad996e1c35f514c4a7a11140fd12a82",
  "office/draw.js":
    "4e063a5d2ceb33a1860859d91c78302022ccec10dc99dcbc99a2b9d42f97145a",
  "office/grid.js":
    "3c10c13e28509c38424b55c7f4ef95e2b63d77654255f5778d58d5d7c936748b",
  "office/labels.js":
    "f3da7738897d61d48c4b7bf0bdb3ed2449c59993ffcbd982627faf9b6ec19eee",
  "office/sim.js":
    "6a159ac8477b3e868f303259ab3d202576462c6a0cd6f997078f36fe73b0676e",
  "office/stage-scene.js":
    "8cae2ef764e70ccbd6dc711a6d7634379f19ab28cce3fec47dbe003709968cb5",
  "office/view.js":
    "dd7effdbb2497b209df9b9d05351e77a74155691d6d2252e598bf29fa7aa11a1",
});

/** The files under app/public/office, as `office/<name>`. */
const officeFiles = () => {
  /** @param {string} rel @returns {string[]} */
  const walk = (rel) =>
    fs
      .readdirSync(path.join(PUBLIC, rel), { withFileTypes: true })
      .flatMap((d) =>
        d.isDirectory() ? walk(`${rel}/${d.name}`) : [`${rel}/${d.name}`],
      );
  return walk("office").sort();
};

test("M2P-4 the six pages of M1, public/js/pages/demo.js and every file under public/office keep the sha256 recorded from the base 60b10b7 (the command of the criterion, git diff --stat against the base tag, prints nothing)", () => {
  assert.deepEqual(
    officeFiles(),
    Object.keys(BASE_SHA256)
      .filter((f) => f.startsWith("office/"))
      .sort(),
    "the office holds the files of the base and no other",
  );
  for (const [rel, want] of Object.entries(BASE_SHA256))
    assert.equal(
      createHash("sha256")
        .update(fs.readFileSync(path.join(PUBLIC, rel)))
        .digest("hex"),
      want,
      rel,
    );
  // The six M1 pages of the closed list are all recorded.
  for (const name of M1_PAGES) assert.ok(`${name}.html` in BASE_SHA256, name);
});

/**
 * The keys a page shows: the data-t and data-t-aria values of its HTML, and every string literal of its script
 * that has the form of a key of M2.
 * @param {string} name
 * @returns {string[]}
 */
function keysOfPage(name) {
  const html = read(`${name}.html`);
  const keys = new Set(
    [...html.matchAll(/\bdata-t(?:-aria)?="([^"]*)"/g)].map((m) => m[1]),
  );
  const script = blank(read(M2_PAGES[name]), true);
  for (const m of script.matchAll(/(["'`])([a-z0-9_]+)\1/g))
    if (/^(m2|consent|inv|acc|prj|adm|qf|stage|board)_[a-z0-9_]+$/.test(m[2]))
      keys.add(m[2]);
  return [...keys].sort();
}

test("M2P-5 every key that a page of M2 shows (data-t, data-t-aria, and the script's string literals of the key forms) has a texts-module entry with a ru, a kk and an en value; the stage names and the board's «Новые» have them too", () => {
  let checked = 0;
  for (const name of Object.keys(M2_PAGES)) {
    const keys = keysOfPage(name);
    assert.ok(keys.length > 0, `${name}: no keys found`);
    for (const k of keys) {
      const entry = /** @type {any} */ (TEXTS)[k];
      assert.ok(entry, `${name}: no text for ${k}`);
      for (const lang of ["ru", "kk", "en"]) {
        assert.equal(typeof entry[lang], "string", `${name}: ${k} ${lang}`);
        assert.ok(
          entry[lang].trim().length > 0,
          `${name}: ${k} ${lang} is empty`,
        );
      }
      checked += 1;
    }
  }
  assert.ok(checked > 100, `${checked} keys`);
  // The keys that the board builds from the stage list stand in no literal: the eleven stage names, and «Новые».
  for (const s of STAGES)
    if (s !== "draft")
      for (const lang of ["ru", "kk", "en"])
        assert.ok(
          /** @type {any} */ (TEXTS)[`stage_${s}`]?.[lang]?.trim(),
          `stage_${s} ${lang}`,
        );
  assert.equal(TEXTS.board_new.ru, "Новые");
  // Literal values the criteria fix.
  assert.equal(TEXTS.prj_b_new.ru, "Новый проект");
  assert.equal(TEXTS.prj_b_create.ru, "Создать");
  assert.equal(TEXTS.adm_b_edit.ru, "Изменить заявку");
  // «Почему»: the label of the reason field of the client's edit form and of the admin's «Изменить заявку» form
  // (the code uses the one key prj_f_why for both; the design names adm_f_why for the admin form, 4.9.3).
  assert.equal(TEXTS.prj_f_why.ru, "Почему");
  for (const page of ["project", "admin-request"]) {
    const label = /<label[^>]*for="edit-reason"[^>]*data-t="([a-z0-9_]+)"/.exec(
      read(`${page}.html`),
    );
    assert.ok(label, `${page}: the label of #edit-reason`);
    assert.equal(
      /** @type {any} */ (TEXTS)[label[1]]?.ru,
      "Почему",
      `${page}: the reason label reads «Почему»`,
    );
  }
  // Self-check of the key scan: a key in a script of a page is found, a key in a comment is not.
  assert.deepEqual(
    [
      ...blank("// prj_hidden\nconst k = 'prj_shown';", true).matchAll(
        /(["'`])([a-z0-9_]+)\1/g,
      ),
    ].map((m) => m[2]),
    ["prj_shown"],
  );
});
