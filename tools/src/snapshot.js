import fs from "node:fs";
import path from "node:path";
import { listFiles, sha256 } from "./util.js";

function skip(rel) {
  return rel === "tools/node_modules" || rel.split("/").includes(".git");
}

export function snapshot(root) {
  return listFiles(root, skip)
    .map((rel) => `${sha256(fs.readFileSync(path.join(root, rel)))}  ${rel}`)
    .join("\n")
    .concat("\n");
}

function parse(text) {
  const map = new Map();
  for (const line of text.split("\n")) {
    if (line === "") continue;
    const sep = line.indexOf("  ");
    map.set(line.slice(sep + 2), line.slice(0, sep));
  }
  return map;
}

export function snapshotDiff(beforeText, afterText, allow) {
  const before = parse(beforeText);
  const after = parse(afterText);
  // A prefix ending in "/" allows a folder; any other value allows exactly one file.
  const allowed = (rel) =>
    allow.some((p) => rel === p || (p.endsWith("/") && rel.startsWith(p)));
  const out = [];
  for (const rel of [...new Set([...before.keys(), ...after.keys()])].sort()) {
    const a = before.get(rel);
    const b = after.get(rel);
    if (a === b || allowed(rel)) continue;
    if (a === undefined) out.push(`added ${rel}`);
    else if (b === undefined) out.push(`removed ${rel}`);
    else out.push(`changed ${rel}`);
  }
  return out;
}
