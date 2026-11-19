import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// check-public (REQ-109 criterion 7, ARCH §3): forbidden texts and forms in the served files of app/public.

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

/** @typedef {{ file: string, item: string }} Finding */

/**
 * @param {string} rel
 * @param {string} text
 * @returns {Finding[]}
 */
export function checkText(rel, text) {
  /** @type {Finding[]} */
  const out = [];
  const add = (/** @type {string} */ item) => out.push({ file: rel, item });
  for (const words of PHRASES) {
    const re = new RegExp(
      `(^|[^${ID}])${words.map(esc).join("\\s+")}(?![${ID}])`,
      "iu",
    );
    if (re.test(text)) add(`phrase «${words.join(" ")}»`);
  }
  if (new RegExp(`(^|[^${ID}])innerHTML(?![${ID}])`).test(text))
    add("innerHTML");
  for (const w of WORDS)
    if (new RegExp(`(^|[^${ID}])${w}(?![${ID}])`, "i").test(text))
      add(`word «${w}»`);
  if (/REQ-(?=\d)/.test(text)) add("REQ- before a digit");
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
  if (rel.startsWith("office/") && /Math\.random/.test(text))
    add("Math.random in office/");
  return out;
}

/**
 * @param {string} dir
 * @returns {Finding[]}
 */
export function checkPublic(dir) {
  /** @type {Finding[]} */
  const out = [];
  /** @param {string} abs @param {string} rel */
  const walk = (abs, rel) => {
    for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
      const a = path.join(abs, e.name);
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) walk(a, r);
      else if (TEXT.has(path.extname(e.name).toLowerCase()))
        out.push(...checkText(r, fs.readFileSync(a, "utf8")));
    }
  };
  walk(dir, "");
  return out;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const dir =
    process.argv[2] ?? fileURLToPath(new URL("../public/", import.meta.url));
  const found = checkPublic(dir);
  for (const f of found)
    process.stdout.write(`check-public: ${f.file}: ${f.item}\n`);
  if (found.length === 0)
    process.stdout.write("check-public: app/public is clean\n");
  process.exitCode = found.length ? 1 : 0;
}
