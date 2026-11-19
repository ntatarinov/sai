import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// vercel-build (ARCH §19.6, REQ-109 criterion 8, decisions/0116 О18): with SITE_GATE empty, migrate
// (only when MIGRATE_ON_BUILD=1), then check-public; the output is app/public. With SITE_GATE non-empty:
// no database call, no migrate; the output folder holds only index.html, the bytes of public/gate.html.

const APP = fileURLToPath(new URL("../", import.meta.url));

/**
 * @typedef {object} BuildDeps
 * @property {Record<string, string | undefined>} env
 * @property {() => number} migrate exit code of the migration step
 * @property {() => number} checkPublic exit code of check-public
 * @property {string} publicDir
 * @property {string} outDir
 * @property {(line: string) => void} log
 */

/**
 * @param {string} dir
 * @returns {boolean}
 */
export function insideGitTree(dir) {
  let at = path.resolve(dir);
  for (;;) {
    if (fs.existsSync(path.join(at, ".git"))) return true;
    const up = path.dirname(at);
    if (up === at) return false;
    at = up;
  }
}

/**
 * @param {BuildDeps} d
 * @returns {number}
 */
export function runBuild(d) {
  const gate = typeof d.env.SITE_GATE === "string" && d.env.SITE_GATE !== "";
  if (gate) {
    const gateBytes = fs.readFileSync(path.join(d.publicDir, "gate.html"));
    if (
      path.resolve(d.outDir) === path.resolve(d.publicDir) &&
      insideGitTree(d.outDir)
    ) {
      d.log(
        "vercel-build: refused: the closed build replaces the output folder and runs only in the uploaded copy, not in a git working tree",
      );
      return 2;
    }
    fs.rmSync(d.outDir, { recursive: true, force: true });
    fs.mkdirSync(d.outDir, { recursive: true });
    fs.writeFileSync(path.join(d.outDir, "index.html"), gateBytes);
    d.log(
      "vercel-build: SITE_GATE is set: the output is the gate page only; no migration",
    );
    return 0;
  }
  if (d.env.MIGRATE_ON_BUILD === "1") {
    const code = d.migrate();
    if (code !== 0) {
      d.log(
        `vercel-build: refused: the migration step ended with code ${code}`,
      );
      return 1;
    }
  }
  const checked = d.checkPublic();
  if (checked !== 0) {
    d.log("vercel-build: refused: check-public found forbidden items");
    return 1;
  }
  if (path.resolve(d.outDir) !== path.resolve(d.publicDir))
    fs.cpSync(d.publicDir, d.outDir, { recursive: true });
  d.log("vercel-build: done");
  return 0;
}

/** @param {string[]} args */
const node = (args) =>
  spawnSync(process.execPath, args, { cwd: APP, stdio: "inherit" }).status ?? 1;

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const publicDir = path.join(APP, "public");
  process.exitCode = runBuild({
    env: process.env,
    migrate: () => node(["server/db/migrate.js"]),
    checkPublic: () => node(["scripts/check-public.js"]),
    publicDir,
    outDir: publicDir,
    log: (l) => process.stdout.write(`${l}\n`),
  });
}
