// The one reader of a folder for the tests of app/test (no test here): what is in it and the bytes of every
// file, as plain lines that `assert.deepEqual` compares before and after a step that must leave a folder as it
// found it (AP-014: one snapshot, so what it sees is the same in every test that uses it).

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/**
 * Every entry under a folder, files and directories, as a path from the folder with `/`, sorted.
 * @param {string} dir
 * @returns {string[]}
 */
export function tree(dir) {
  return fs
    .readdirSync(dir, { recursive: true })
    .map((e) => String(e).split(path.sep).join("/"))
    .sort();
}

/**
 * The files under a folder (no directory), as a path from the folder with `/`, sorted.
 * @param {string} dir
 * @returns {string[]}
 */
export function fileNames(dir) {
  return tree(dir).filter((e) => fs.statSync(path.join(dir, e)).isFile());
}

/**
 * The names and the bytes of everything under a folder: a file as "path sha256", a directory as "path dir",
 * so an added, removed or changed file and an added or removed directory all change the result.
 * @param {string} dir
 * @returns {string[]}
 */
export function snapshot(dir) {
  return tree(dir).map((e) => {
    const full = path.join(dir, e);
    return fs.statSync(full).isFile()
      ? `${e} ${createHash("sha256").update(fs.readFileSync(full)).digest("hex")}`
      : `${e} dir`;
  });
}
