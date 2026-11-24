import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  CONSENT_KEYS,
  LANGS as LINT_LANGS,
  lintText,
  stripDeletionTerm,
} from "./word-lists.js";

// check-public (REQ-109 criterion 7, REQ-111 criteria 3 and 10, ARCH §3; design
// docs/design/REQ-111-112-public-landing.md, 4.10): forbidden texts and forms in the served files of a public
// folder, and the forbidden-words lint of its texts module, its pages and the intake beside it.
//
// 1. Every served text file of the folder (checkText): the rules of REQ-109 criterion 7 — the three phrases,
//    innerHTML, a style or on… attribute, a <style> element, a <script> without src, the word ban, an
//    http:// or https:// address — and the closed list of the code forms of REQ-111 criterion 10, each
//    compared with the identifier border (no A-Za-z0-9_$ before or after; for srcdoc no "-" either) and with
//    spaces allowed around each "." and before each "(": outerHTML, insertAdjacentHTML, document.write and
//    .writeln, createContextualFragment, parseFromString, setHTML, setHTMLUnsafe, parseHTMLUnsafe, srcdoc,
//    setAttribute( with the name style (the name in any letter case) in ', " or ` quotes, .style.cssText,
//    eval followed by (, new followed by Function, and Math.random in any served file (under office/ also
//    in any spelling, as REQ-109 had it); file:// after a sign that is no letter or digit, in any letter
//    case; and the four demo phrases between word borders, in any letter case, with any white space after
//    the colon. One label per form.
// 2. The lint of word-lists.js (REQ-111 criterion 3): (a) the texts module of the folder,
//    shared/i18n/texts.js, imported by its file URL with the sha256 of its bytes as the query, every value of
//    every key in its language (the LANGS of the module) — the lists, the word ban and the phrases; (b) every
//    .html file: the visible text (the text outside tags, with comments and the content of <script> elements
//    left out, the content of <noscript> read as text; every tag is a border, and the character references
//    are read) and the values of alt, title, aria-label and content, in ru; (c) the intake, ../content/sai-intake.json beside the folder: every text of a language in its
//    language, every other string with the word ban, the phrases and the ru lists. A missing or unreadable
//    texts module or intake is a finding. The string literals of the page scripts are not read by the lint
//    (rule 1 holds the word ban and the phrases there): a text that a script writes is linted where the page
//    shows it, by the browser tests.
//
// CLI: node scripts/check-public.js [<public dir>] (default app/public) — one line
// `check-public: <file>: <item>` per finding and exit 1 (for the lint the item is
// `<place>: <lang>: list <name> «<form>»`, the place `key <key>`, `text`, `attribute <name>` or a path of
// the intake such as questions[0].options[1].label), else `check-public: app/public is clean` and exit 0.

const TEXT = new Set([".html", ".css", ".js", ".svg", ".txt", ".json"]);
const PHRASES = [
  ["Claude", "Code"],
  ["Около", "2", "минут"],
  ["типовой", "вариант"],
];
const WORDS = ["handoff", "handoffs", "orch", "decisions"];
const ID = "A-Za-z0-9_$";
const esc = (/** @type {string} */ s) =>
  s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const PHRASE_RULES = PHRASES.map((words) => ({
  item: `phrase «${words.join(" ")}»`,
  re: new RegExp(`(^|[^${ID}])${words.map(esc).join("\\s+")}(?![${ID}])`, "iu"),
}));
const WORD_RULES = WORDS.map((w) => ({
  item: `word «${w}»`,
  re: new RegExp(`(^|[^${ID}])${w}(?![${ID}])`, "i"),
}));

// The code forms of REQ-111 criterion 10 (a closed list: a form not on it is no violation of it).
const BEFORE = `(?<![${ID}])`;
const AFTER = `(?![${ID}])`;
const DOT = "\\s*\\.\\s*";
const OPEN = "\\s*\\(";
const STYLE_NAME = "[sS][tT][yY][lL][eE]";
/** @param {string} body @param {string} [flags] */
const rule = (body, flags) => new RegExp(body, flags);
/** @type {Array<{ item: string, re: RegExp }>} */
const CODE_FORMS = [
  { item: "outerHTML", re: rule(`${BEFORE}outerHTML${AFTER}`) },
  {
    item: "insertAdjacentHTML",
    re: rule(`${BEFORE}insertAdjacentHTML${AFTER}`),
  },
  { item: "document.write", re: rule(`${BEFORE}document${DOT}write${AFTER}`) },
  {
    item: "document.writeln",
    re: rule(`${BEFORE}document${DOT}writeln${AFTER}`),
  },
  {
    item: "createContextualFragment",
    re: rule(`${BEFORE}createContextualFragment${AFTER}`),
  },
  { item: "parseFromString", re: rule(`${BEFORE}parseFromString${AFTER}`) },
  { item: "setHTML", re: rule(`${BEFORE}setHTML${AFTER}`) },
  { item: "setHTMLUnsafe", re: rule(`${BEFORE}setHTMLUnsafe${AFTER}`) },
  { item: "parseHTMLUnsafe", re: rule(`${BEFORE}parseHTMLUnsafe${AFTER}`) },
  { item: "srcdoc", re: rule(`(?<![${ID}-])srcdoc(?![${ID}-])`) },
  ...[
    ["'", "'"],
    ['"', '"'],
    ["`", "`"],
  ].map(([quote, label]) => ({
    item: `setAttribute(${label}style${label})`,
    re: rule(`${BEFORE}setAttribute${OPEN}\\s*${quote}${STYLE_NAME}${quote}`),
  })),
  { item: ".style.cssText", re: rule(`\\.\\s*style${DOT}cssText${AFTER}`) },
  { item: "eval(", re: rule(`${BEFORE}eval${OPEN}`) },
  { item: "new Function", re: rule(`${BEFORE}new\\s+Function${AFTER}`) },
  { item: "file://", re: rule("(?<![A-Za-z0-9])file://", "i") },
  ...[
    ["Демо", "компания"],
    ["Демо", "этап"],
    ["Demo", "company"],
    ["Demo", "stage"],
  ].map(([first, second]) => ({
    item: `phrase «${first}: ${second}»`,
    re: rule(
      `(?<![\\p{L}\\p{N}])${first}:\\s*${second}(?![\\p{L}\\p{N}])`,
      "iu",
    ),
  })),
];
const MATH_RANDOM = rule(`${BEFORE}Math${DOT}random${AFTER}`);

/** @typedef {{ file: string, item: string }} Finding */

/**
 * The phrases of REQ-109 criterion 7 that a text holds.
 * @param {string} text
 * @returns {string[]}
 */
const phraseBan = (text) =>
  PHRASE_RULES.filter((r) => r.re.test(text)).map((r) => r.item);

/**
 * The word ban of decision 0074 item 6 in a text: the four whole words and REQ- before a digit.
 * @param {string} text
 * @returns {string[]}
 */
function wordBan(text) {
  const out = WORD_RULES.filter((r) => r.re.test(text)).map((r) => r.item);
  if (/REQ-(?=\d)/.test(text)) out.push("REQ- before a digit");
  return out;
}

/**
 * The rules of one served file (rule 1).
 * @param {string} rel
 * @param {string} text
 * @returns {Finding[]}
 */
export function checkText(rel, text) {
  /** @type {Finding[]} */
  const out = [];
  const add = (/** @type {string} */ item) => out.push({ file: rel, item });
  phraseBan(text).forEach(add);
  if (new RegExp(`(^|[^${ID}])innerHTML(?![${ID}])`).test(text))
    add("innerHTML");
  wordBan(text).forEach(add);
  for (const tag of text.matchAll(
    /<([A-Za-z][A-Za-z0-9-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g,
  )) {
    const name = tag[1].toLowerCase();
    const attrs = tag[2];
    const bare = attrs.replace(/"[^"]*"|'[^']*'/g, '""');
    if (/(^|\s)(style|on[a-z]+)\s*=/i.test(bare))
      add(`attribute style or on… in <${name}>`);
    if (name === "style") add("a <style> element");
    if (name === "script" && !/(^|\s)src\s*=/i.test(bare))
      add("a <script> without src");
  }
  const withoutXmlns = text.replace(
    /\sxmlns(:[A-Za-z0-9_-]+)?\s*=\s*("[^"]*"|'[^']*')/g,
    " ",
  );
  if (/https?:\/\//i.test(withoutXmlns)) add("an http:// or https:// address");
  for (const form of CODE_FORMS) if (form.re.test(text)) add(form.item);
  if (
    MATH_RANDOM.test(text) ||
    (rel.startsWith("office/") && /Math\.random/.test(text))
  )
    add("Math.random");
  return out;
}

/**
 * @param {Buffer} bytes
 * @returns {string} the sha256 of `bytes` in lowercase hex
 */
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

/**
 * Why a file could not be read, in words: "is missing" for ENOENT, else "cannot be read (<code>)".
 * @param {unknown} err
 * @returns {string}
 */
function readFailure(err) {
  const code = /** @type {NodeJS.ErrnoException} */ (err).code;
  if (code === "ENOENT") return "is missing";
  return `cannot be read (${typeof code === "string" ? code : "an error"})`;
}

/**
 * The lint items of one text in one language (rule 2): `list <name> «<form>»` for each form of the lists,
 * then the phrases and the word ban unless `listsOnly`.
 * @param {string} text
 * @param {string} lang
 * @param {boolean} listsOnly
 * @returns {string[]}
 */
function lintItems(text, lang, listsOnly) {
  const items = lintText(text, lang).map((f) => `list ${f.list} «${f.form}»`);
  if (!listsOnly) items.push(...phraseBan(text), ...wordBan(text));
  return items;
}

const TEXTS_FILE = "shared/i18n/texts.js";

/**
 * Rule 2 (a): every value of every key of the texts module of `dir`, in its language.
 * @param {string} dir
 * @param {(item: string) => void} add
 */
async function lintTextsModule(dir, add) {
  const abs = path.join(dir, TEXTS_FILE);
  /** @type {Buffer} */
  let bytes;
  try {
    bytes = fs.readFileSync(abs);
  } catch (err) {
    add(`the texts module ${readFailure(err)}`);
    return;
  }
  /** @type {{ LANGS?: unknown, TEXTS?: unknown }} */
  let mod;
  try {
    mod = await import(`${pathToFileURL(abs).href}?sha256=${sha256(bytes)}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    add(`the texts module cannot be imported: ${message.split("\n")[0]}`);
    return;
  }
  const { LANGS: langs, TEXTS: texts } = mod;
  if (
    !Array.isArray(langs) ||
    langs.length === 0 ||
    !langs.every((l) => typeof l === "string" && LINT_LANGS.includes(l))
  ) {
    add("the texts module: LANGS is not a list of the languages ru, kk, en");
    return;
  }
  if (texts === null || typeof texts !== "object" || Array.isArray(texts)) {
    add("the texts module: TEXTS is not an object of texts");
    return;
  }
  for (const [key, entry] of Object.entries(texts)) {
    if (entry === null || typeof entry !== "object") {
      add(`key ${key}: not an object of the languages`);
      continue;
    }
    for (const lang of /** @type {string[]} */ (langs)) {
      const value = /** @type {Record<string, unknown>} */ (entry)[lang];
      if (typeof value !== "string") add(`key ${key}: ${lang}: not a string`);
      else
        // The one narrow exception (REQ-111 criterion 3 as amended): a consent key is linted with its deletion
        // term phrase taken out once; every other value of every key is linted whole.
        for (const item of lintItems(
          CONSENT_KEYS.includes(key) ? stripDeletionTerm(value, lang) : value,
          lang,
          false,
        ))
          add(`key ${key}: ${lang}: ${item}`);
    }
  }
}

const COMMENT = /<!--[\s\S]*?(?:-->|$)/g;
const SCRIPT =
  /<script(?![A-Za-z0-9-])(?:[^>"']|"[^"]*"|'[^']*')*>[\s\S]*?(?:<\/script\s*>|$)/gi;
const START_TAG = /<([A-Za-z][A-Za-z0-9-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;
const OTHER_TAG = /<\/[A-Za-z][A-Za-z0-9-]*\s*>|<![^>]*>/g;
const ATTRIBUTE =
  /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
const LINTED_ATTRIBUTES = new Set(["alt", "title", "aria-label", "content"]);
// The named character references that the text of a page may hold; any other stays as written (its & and ;
// are borders of the words around it). The numeric references are all read.
/** @type {Record<string, string>} */
const NAMED = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: "\u00a0",
  shy: "\u00ad",
  percnt: "%",
  ndash: "\u2013",
  mdash: "\u2014",
  laquo: "\u00ab",
  raquo: "\u00bb",
  hellip: "\u2026",
};

/**
 * The text of `html` with its character references read.
 * @param {string} html
 * @returns {string}
 */
const decode = (html) =>
  html.replace(
    /&(?:#([0-9]{1,7})|#[xX]([0-9A-Fa-f]{1,6})|([A-Za-z][A-Za-z0-9]{0,31}));/g,
    (ref, dec, hex, name) => {
      if (name !== undefined)
        return Object.hasOwn(NAMED, name) ? NAMED[name] : ref;
      const cp = dec !== undefined ? Number(dec) : parseInt(hex, 16);
      return cp > 0 && cp <= 0x10ffff && (cp < 0xd800 || cp > 0xdfff)
        ? String.fromCodePoint(cp)
        : ref;
    },
  );

/**
 * Rule 2 (b): the visible text of one page and the values of its alt, title, aria-label and content
 * attributes, in ru.
 * @param {string} html
 * @param {(item: string) => void} add
 */
function lintPage(html, add) {
  const read = html.replace(COMMENT, " ").replace(SCRIPT, " ");
  for (const tag of read.matchAll(START_TAG))
    for (const a of tag[2].matchAll(ATTRIBUTE)) {
      const name = a[1].toLowerCase();
      const value = a[2] ?? a[3] ?? a[4];
      if (value !== undefined && LINTED_ATTRIBUTES.has(name))
        for (const item of lintItems(decode(value), "ru", true))
          add(`attribute ${name}: ru: ${item}`);
    }
  const text = decode(read.replace(START_TAG, " ").replace(OTHER_TAG, " "));
  for (const item of lintItems(text, "ru", true)) add(`text: ru: ${item}`);
}

const INTAKE_FILE = "../content/sai-intake.json";

/**
 * Rule 2 (c) for one value of the intake and every value inside it: a string under the key of a language
 * (ru, kk, en) is a text of that language, any other string is linted with the ru lists; both with the
 * word ban and the phrases.
 * @param {unknown} value
 * @param {string} place the path of the value, such as questions[0].options[1].label
 * @param {string | null} lang the language whose key holds the value, else null
 * @param {(item: string) => void} add
 */
function lintIntakeValue(value, place, lang, add) {
  if (typeof value === "string") {
    const as = lang ?? "ru";
    for (const item of lintItems(value, as, false))
      add(`${place === "" ? "(root)" : place}: ${as}: ${item}`);
  } else if (Array.isArray(value))
    value.forEach((v, i) => lintIntakeValue(v, `${place}[${i}]`, null, add));
  else if (value !== null && typeof value === "object")
    for (const [key, v] of Object.entries(value)) {
      const ofLang = typeof v === "string" && LINT_LANGS.includes(key);
      const at = place === "" ? key : `${place}.${key}`;
      lintIntakeValue(v, ofLang ? place : at, ofLang ? key : null, add);
    }
}

/**
 * Rule 2 (c): every string of the intake beside `dir`.
 * @param {string} dir
 * @param {(item: string) => void} add
 */
function lintIntake(dir, add) {
  /** @type {string} */
  let text;
  try {
    text = fs.readFileSync(
      path.join(dir, "..", "content", "sai-intake.json"),
      "utf8",
    );
  } catch (err) {
    add(`the intake ${readFailure(err)}`);
    return;
  }
  /** @type {unknown} */
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    add("the intake is not JSON");
    return;
  }
  lintIntakeValue(data, "", null, add);
}

/**
 * Every rule of this file on the public folder `dir`, its texts module and the intake beside it.
 * @param {string} dir
 * @returns {Promise<Finding[]>}
 */
export async function checkPublic(dir) {
  /** @type {Finding[]} */
  const out = [];
  const seen = new Set();
  /** @param {string} file @returns {(item: string) => void} */
  const adder = (file) => (item) => {
    const id = `${file}\u0000${item}`;
    if (seen.has(id)) return;
    seen.add(id);
    out.push({ file, item });
  };
  /** @param {string} abs @param {string} rel */
  const walk = (abs, rel) => {
    /** @type {fs.Dirent[]} */
    let list;
    try {
      list = fs.readdirSync(abs, { withFileTypes: true });
    } catch (err) {
      adder(rel === "" ? "." : rel)(`the folder ${readFailure(err)}`);
      return;
    }
    list.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const e of list) {
      const a = path.join(abs, e.name);
      const r = rel ? `${rel}/${e.name}` : e.name;
      const ext = path.extname(e.name).toLowerCase();
      if (e.isDirectory()) walk(a, r);
      else if (TEXT.has(ext)) {
        /** @type {string} */
        let text;
        try {
          text = fs.readFileSync(a, "utf8");
        } catch (err) {
          adder(r)(`the file ${readFailure(err)}`);
          continue;
        }
        const add = adder(r);
        for (const f of checkText(r, text)) add(f.item);
        if (ext === ".html") lintPage(text, add);
      }
    }
  };
  walk(dir, "");
  await lintTextsModule(dir, adder(TEXTS_FILE));
  lintIntake(dir, adder(INTAKE_FILE));
  return out;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const dir =
    process.argv[2] ?? fileURLToPath(new URL("../public/", import.meta.url));
  const found = await checkPublic(dir);
  for (const f of found)
    process.stdout.write(`check-public: ${f.file}: ${f.item}\n`);
  if (found.length === 0)
    process.stdout.write("check-public: app/public is clean\n");
  process.exitCode = found.length ? 1 : 0;
}
