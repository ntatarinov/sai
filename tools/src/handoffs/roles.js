// The codes of the roles of Sai (design REQ-039, 4.2): read from the files
// .claude/agents/*.md, never written into the code. Every fs call goes through the
// default `fs` object, so that the tests can inject failures.
import fs from "node:fs";
import path from "node:path";
import { isOsError } from "../util.js";
import { HandoffError } from "./errors.js";

const MAX_BYTES = 1024 * 1024;
const CODE = /^[A-Z][A-Z0-9-]*$/u;
const DIR = ".claude/agents";

function rolesError(reason) {
  return new HandoffError(
    "E_HO_ROLES",
    `список ролей не прочитан: ${reason}`,
    2,
  );
}

// The code in the last pair of brackets at the end of the line `name:`, or null.
function codeOfLine(line) {
  const m = /\(([^()]*)\)\s*$/u.exec(line);
  return m !== null && CODE.test(m[1]) ? m[1] : null;
}

// The code of one file: the line `name:` inside the first block between two `---`.
function codeOfFile(text) {
  const lines = text.split("\n").map((l) => l.replace(/\r$/u, ""));
  const start = lines.findIndex((l) => l.trimEnd() === "---");
  if (start < 0) return null;
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].trimEnd() === "---") return null;
    if (lines[i].startsWith("name:")) return codeOfLine(lines[i]);
  }
  return null;
}

// The codes, sorted by bytes, without repeats.
export function readRoles(root) {
  const dir = path.join(root, DIR);
  let names;
  try {
    names = fs.readdirSync(dir).filter((n) => n.endsWith(".md"));
  } catch (err) {
    if (!isOsError(err)) throw err;
    throw rolesError(`${DIR} не читается (${err.code})`);
  }
  const codes = new Set();
  for (const name of names) {
    const file = path.join(dir, name);
    let text;
    try {
      const stat = fs.lstatSync(file);
      if (!stat.isFile() || stat.size > MAX_BYTES) continue;
      text = fs.readFileSync(file, "utf8");
    } catch (err) {
      if (!isOsError(err)) throw err;
      throw rolesError(`${DIR}/${name} не читается (${err.code})`);
    }
    const code = codeOfFile(text);
    if (code !== null) codes.add(code);
  }
  if (codes.size === 0)
    throw rolesError(`в ${DIR}/ нет ни одной строки name: <Название> (КОД)`);
  return [...codes].sort((a, b) =>
    Buffer.compare(Buffer.from(a, "utf8"), Buffer.from(b, "utf8")),
  );
}
