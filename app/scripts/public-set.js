import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { PUBLIC_LANGS } from "../public/shared/i18n/lang.js";

// The public set of the open build (REQ-111 criterion 9, gates G8 «б» and G9; design
// docs/design/REQ-111-112-public-landing.md, 4.11): the local set of app/public without what production
// leaves out. vercel-build.js writes it in place in the uploaded copy: the texts module of the public
// languages without the order_ keys, no examples.html, and every page without its regions of the closed
// kinds. A region is the lines from a marker line <!-- sai:order --> or <!-- sai:kk --> to the end marker
// line of its kind, both included. Every other file stays byte for byte.
//
// Protection in the same operation as the action (4.11, section 7 of the design): first every entry of the
// folder is read by lstat, and a symbolic link anywhere in it (a page, the texts module, a folder,
// examples.html) is refused with an Error naming it, so no read, write or removal goes through a link and
// out of the folder; then the texts module is imported and the markers of every page are read as one
// sequence before anything is written, so a texts module that cannot be imported or exports other names,
// and a page that cannot be read as regions, are refused with an Error naming the file (and for a page the
// line) while the folder is as it was; the cut takes exactly the regions read; then the output is read
// again, failing closed with an Error naming the file on a marker of a closed kind, an examples.html
// reference or an element data-lang="kk" left. A second run on its own output changes nothing, and with
// the gates open the output is the source byte for byte.

/**
 * Gate G8, the order texts: false while the owner's answer is «б» (built and checked here, left out of
 * production). Changing it is a release.
 * @type {boolean}
 */
export const ORDER_TEXTS_PUBLIC = false;

/** The gates of the public set: the public languages (G9, PUBLIC_LANGS of lang.js) and the order texts (G8). */
export const GATES = Object.freeze({
  langs: PUBLIC_LANGS,
  orderTexts: ORDER_TEXTS_PUBLIC,
});

const TEXTS_FILE = "shared/i18n/texts.js";
const EXAMPLES = "examples.html";
// A marker line: one of the four forms alone on its line, with spaces or tabs around it.
const MARKER_LINE = /^[ \t]*<!-- (\/?)sai:(order|kk) -->[ \t]*$/;
// A marker-like comment: <!--, an optional /, sai in any letter case and a colon, any white space or none
// between them.
const MARKER_LIKE = /<!--\s*\/?\s*sai\s*:/i;
// The kind word of every marker-like comment of the output (any spacing, any letter case).
const MARKER_KIND = /<!--\s*\/?\s*sai\s*:\s*([a-z]+)/gi;
// An element data-lang="kk" (the value quoted or not, the name in any letter case).
const KK_ELEMENT = /data-lang\s*=\s*(?:"\s*kk\s*"|'\s*kk\s*'|kk(?=[\s/>]|$))/i;

/**
 * @param {Buffer} bytes
 * @returns {string} the sha256 of `bytes` in lowercase hex
 */
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

/**
 * @param {unknown} err
 * @returns {string}
 */
const messageOf = (err) => (err instanceof Error ? err.message : String(err));

/**
 * A region of a page: its kind and the indexes of its opening and its end marker line among the lines of
 * the text split at "\n" (line n of a message is index n - 1).
 * @typedef {{ kind: "order" | "kk", from: number, to: number }} Region
 */

/**
 * The regions of one page, its markers read as one sequence before anything is cut. Every line is read
 * for the four marker forms and for a marker-like comment, inside a region as well (decisions/0124 H1);
 * only the content between the two marker lines of a region is not interpreted, because it is cut whole.
 * An opening marker opens a region of its kind only while no region is open, and the next marker line
 * must be the end marker of that kind, which closes it. Any other shape throws an Error naming the file
 * and the line.
 * @param {string} html
 * @param {string} file the path of the page in its folder, for the message
 * @returns {Region[]}
 */
export function readRegions(html, file) {
  const lines = html.split("\n");
  /** @type {Region[]} */
  const regions = [];
  /** @type {{ kind: "order" | "kk", from: number } | null} */
  let open = null;
  for (let i = 0; i < lines.length; i++) {
    const m = MARKER_LINE.exec(lines[i]);
    if (m === null) {
      if (MARKER_LIKE.test(lines[i]))
        throw new Error(
          `${file}: line ${i + 1}: a marker that is not alone on its line or not one of the four forms`,
        );
      continue;
    }
    const kind = /** @type {"order" | "kk"} */ (m[2]);
    if (m[1] === "") {
      if (open !== null)
        throw new Error(
          `${file}: line ${i + 1}: an opening marker while the ${open.kind} region of line ${open.from + 1} is open`,
        );
      open = { kind, from: i };
    } else if (open === null || open.kind !== kind) {
      throw new Error(
        `${file}: line ${i + 1}: an end marker with no region of its kind open`,
      );
    } else {
      regions.push({ kind, from: open.from, to: i });
      open = null;
    }
  }
  if (open !== null)
    throw new Error(`${file}: line ${open.from + 1}: a region never closed`);
  return regions;
}

/**
 * The page without its regions of the kinds `kinds`: for every region that readRegions gives (so a page
 * that cannot be read as regions throws first and is never cut) whose kind is in `kinds`, its lines from
 * its opening to its end marker line, both included, are removed; every other line stays byte for byte.
 * @param {string} html
 * @param {readonly string[]} kinds
 * @param {string} file the path of the page in its folder, for the messages of readRegions
 * @returns {string}
 */
export function stripRegions(html, kinds, file) {
  /** @type {Set<number>} */
  const cut = new Set();
  for (const r of readRegions(html, file))
    if (kinds.includes(r.kind)) for (let i = r.from; i <= r.to; i++) cut.add(i);
  if (cut.size === 0) return html;
  return html
    .split("\n")
    .filter((_, i) => !cut.has(i))
    .join("\n");
}

/**
 * The text of a texts module: one comment line, LANGS, then TEXTS with one line per key in the order of
 * `texts`, each entry holding the values of `langs` in their order, keys and values written by
 * JSON.stringify. Rendering the LANGS and TEXTS of the module it gives yields the same text (a fixed
 * point). A value of `langs` that an entry does not hold as a string throws a TypeError: no entry is
 * written without one of its languages.
 * @param {readonly string[]} langs
 * @param {Record<string, Record<string, unknown>>} texts
 * @returns {string}
 */
export function renderTexts(langs, texts) {
  const lines = [
    "// The texts of the public set, key to its value in each public language, written by the build from the texts module of the source.",
    `export const LANGS = Object.freeze(${JSON.stringify(langs)});`,
    "export const TEXTS = Object.freeze({",
  ];
  for (const [key, entry] of Object.entries(texts)) {
    const values = langs.map((lang) => {
      const value = entry[lang];
      if (typeof value !== "string")
        throw new TypeError(
          `${TEXTS_FILE}: the key ${key} has no ${lang} text`,
        );
      return `${JSON.stringify(lang)}:${JSON.stringify(value)}`;
    });
    lines.push(`${JSON.stringify(key)}: Object.freeze({${values.join(",")}}),`);
  }
  lines.push("});", "");
  return lines.join("\n");
}

/**
 * Refuses a folder that is a symbolic link or holds one at any depth: the public set reads, writes and
 * removes only the plain files and folders of its own folder, so nothing it does can leave the folder
 * through a link. Every entry is read by lstat (a link is never followed); the first link, in a fixed
 * order, throws an Error naming its path in the folder ("/" separators).
 * @param {string} dir
 * @returns {void}
 */
export function refuseLinks(dir) {
  if (fs.lstatSync(dir).isSymbolicLink())
    throw new Error(
      "the folder of the public set is a symbolic link, which the public set does not follow",
    );
  /** @param {string} abs @param {string} rel */
  const walk = (abs, rel) => {
    const entries = fs
      .readdirSync(abs, { withFileTypes: true })
      .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const e of entries) {
      const r = rel === "" ? e.name : `${rel}/${e.name}`;
      if (e.isSymbolicLink())
        throw new Error(
          `${r}: a symbolic link, which the public set does not follow`,
        );
      if (e.isDirectory()) walk(path.join(abs, e.name), r);
    }
  };
  walk(dir, "");
}

/**
 * The .html files of `dir` and of its folders (the extension in any letter case), as paths with "/"
 * separators, in a fixed order; a link to a folder is not followed (and writePublicSet has refused any
 * link before).
 * @param {string} dir
 * @returns {string[]}
 */
function htmlFiles(dir) {
  /** @type {string[]} */
  const out = [];
  /** @param {string} abs @param {string} rel */
  const walk = (abs, rel) => {
    const entries = fs
      .readdirSync(abs, { withFileTypes: true })
      .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const e of entries) {
      const r = rel === "" ? e.name : `${rel}/${e.name}`;
      if (e.isDirectory()) walk(path.join(abs, e.name), r);
      else if (path.extname(e.name).toLowerCase() === ".html") out.push(r);
    }
  };
  walk(dir, "");
  return out;
}

/**
 * @param {string} abs
 * @returns {boolean} whether there is an entry at `abs` (a link is not followed)
 */
export function present(abs) {
  try {
    fs.lstatSync(abs);
    return true;
  } catch (err) {
    if (/** @type {NodeJS.ErrnoException} */ (err).code === "ENOENT")
      return false;
    throw err;
  }
}

/**
 * Writes the public set in place in the folder `dir` (the upload, or a copy of app/public), in the order of
 * 4.11, after a refusal of any symbolic link in the folder (refuseLinks): (1) import the texts module; (2)
 * read the regions of every page; (3) write the texts module of the public languages without the order_
 * keys, only when that drops a language or a key; (4) remove examples.html; (5) cut the regions of the
 * closed kinds from every page; (6) read the output again. The link refusal and steps (1) and (2) refuse
 * before anything is read through a link or written; every refusal is an Error naming the file.
 * @param {string} dir
 * @param {{ langs: readonly string[], orderTexts: boolean }} [gates]
 * @returns {Promise<{ changed: string[], removed: string[] }>} the paths in `dir` ("/" separators) of the
 *   files written and of the files removed
 */
export async function writePublicSet(dir, gates = GATES) {
  // No symbolic link anywhere in the folder: every later step reads and writes plain files only.
  refuseLinks(dir);
  // (1) The texts module, imported by its file URL with the sha256 of its bytes as the query, so the
  // import reads the bytes this folder holds now, not a module an earlier run of the process cached.
  const textsAbs = path.join(dir, TEXTS_FILE);
  /** @type {Record<string, unknown>} */
  let mod;
  try {
    const bytes = fs.readFileSync(textsAbs);
    mod = await import(
      `${pathToFileURL(textsAbs).href}?sha256=${sha256(bytes)}`
    );
  } catch (err) {
    throw new Error(
      `${TEXTS_FILE}: the texts module cannot be imported: ${messageOf(err)}`,
      { cause: err },
    );
  }
  const names = Object.keys(mod).sort();
  if (names.length !== 2 || names[0] !== "LANGS" || names[1] !== "TEXTS")
    throw new Error(
      `${TEXTS_FILE}: the texts module exports ${names.length > 0 ? names.join(", ") : "no name"}, not exactly LANGS and TEXTS`,
    );
  // (2) The markers of every page, of every kind whatever the gates: the first page that cannot be read as
  // regions throws, and nothing has been written yet.
  const pages = htmlFiles(dir);
  /** @type {Map<string, string>} */
  const source = new Map();
  for (const rel of pages) {
    const html = fs.readFileSync(path.join(dir, rel), "utf8");
    readRegions(html, rel);
    source.set(rel, html);
  }
  /** @type {string[]} */
  const changed = [];
  /** @type {string[]} */
  const removed = [];
  // (3) The languages of the module that are public, in its order, and its keys without the order_ ones
  // unless the order texts are public. The file is written only when this drops a language (of LANGS or of
  // an entry) or a key; else it stays byte for byte (the second run).
  const sourceLangs = /** @type {string[]} */ (mod.LANGS);
  const texts = /** @type {Record<string, Record<string, unknown>>} */ (
    mod.TEXTS
  );
  const langs = sourceLangs.filter((l) => gates.langs.includes(l));
  const keys = Object.keys(texts).filter(
    (k) => gates.orderTexts || !k.startsWith("order_"),
  );
  const drops =
    langs.length !== sourceLangs.length ||
    keys.length !== Object.keys(texts).length ||
    keys.some((k) => Object.keys(texts[k]).some((l) => !langs.includes(l)));
  if (drops) {
    fs.writeFileSync(
      textsAbs,
      renderTexts(langs, Object.fromEntries(keys.map((k) => [k, texts[k]]))),
    );
    changed.push(TEXTS_FILE);
  }
  // (4) The page of the order examples, unless the order texts are public.
  if (!gates.orderTexts && present(path.join(dir, EXAMPLES))) {
    fs.rmSync(path.join(dir, EXAMPLES));
    removed.push(EXAMPLES);
  }
  // (5) Every page without its regions of the closed kinds, cut from the text read at step (2).
  const closed = [
    ...(gates.orderTexts ? [] : ["order"]),
    ...(gates.langs.includes("kk") ? [] : ["kk"]),
  ];
  for (const rel of pages) {
    if (removed.includes(rel)) continue;
    const html = /** @type {string} */ (source.get(rel));
    const out = stripRegions(html, closed, rel);
    if (out !== html) {
      fs.writeFileSync(path.join(dir, rel), out);
      changed.push(rel);
    }
  }
  // (6) The output read again: no marker of a closed kind (markers of an open kind stay), no examples.html
  // reference while the order texts are closed, no element data-lang="kk" while kk is closed.
  for (const rel of htmlFiles(dir)) {
    const out = fs.readFileSync(path.join(dir, rel), "utf8");
    for (const m of out.matchAll(MARKER_KIND)) {
      const kind = m[1].toLowerCase();
      if (closed.includes(kind))
        throw new Error(
          `${rel}: a marker of the closed kind ${kind} is left after the cut`,
        );
    }
    if (!gates.orderTexts && /examples\.html/i.test(out))
      throw new Error(
        `${rel}: an examples.html reference is left while the order texts are closed`,
      );
    if (closed.includes("kk") && KK_ELEMENT.test(out))
      throw new Error(
        `${rel}: an element data-lang="kk" is left while kk is closed`,
      );
  }
  return { changed: changed.sort(), removed };
}
