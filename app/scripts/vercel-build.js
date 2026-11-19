import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// vercel-build (ARCH §19.6, REQ-109 criterion 8, decisions/0116 О18): with SITE_GATE empty, migrate
// (only when MIGRATE_ON_BUILD=1), then check-public; the output is app/public. With SITE_GATE non-empty:
// no database call, no migrate; the output folder holds only index.html, the bytes of the gate page.
//
// The bytes of the gate page are the bytes of app/public/gate.html, pinned by their sha256 in GATE_SHA256
// (unit test VB-3 compares the two, so a new gate page without a new constant is red in npm run check). A
// closed run whose public/gate.html holds other bytes is refused (fail closed) and changes nothing, so no
// closed run writes an output that the second run of the same build would refuse.
//
// The platform runs vercel-build twice in one build (the node builder and the static builder; spike S1,
// decisions/0122 О5 (4)), and on Vercel the output folder is public/ itself. The first closed run
// replaces public/ with the gate page alone, so the second finds no public/gate.html: when the folder
// already holds only index.html, a regular file with the bytes of the gate page (closedOutput, compared
// by sha256), it changes nothing and ends with 0; any other closed run without public/gate.html is
// refused (fail closed).

const APP = fileURLToPath(new URL("../", import.meta.url));
// The sha256 of the bytes of the gate page, app/public/gate.html (a new gate page comes with a new value).
export const GATE_SHA256 =
  "ac889bc15c7c6346acb45b932d021b2a70186d2fe5c286b86b7749792b1a065d";

/**
 * @param {Buffer} bytes
 * @returns {string} the sha256 of `bytes` in lowercase hex
 */
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

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
 * Whether `dir` is the closed output of an earlier run: exactly one entry, `index.html`, a regular file
 * (not a link) holding the bytes of the gate page (its sha256 is GATE_SHA256). False when the folder
 * cannot be read.
 * @param {string} dir
 * @returns {boolean}
 */
export function closedOutput(dir) {
  try {
    const names = fs.readdirSync(dir);
    if (names.length !== 1 || names[0] !== "index.html") return false;
    const file = path.join(dir, "index.html");
    if (!fs.lstatSync(file).isFile()) return false;
    return sha256(fs.readFileSync(file)) === GATE_SHA256;
  } catch {
    return false;
  }
}

/**
 * @param {BuildDeps} d
 * @returns {number}
 */
export function runBuild(d) {
  const gate = typeof d.env.SITE_GATE === "string" && d.env.SITE_GATE !== "";
  if (gate) {
    const inPlace = path.resolve(d.outDir) === path.resolve(d.publicDir);
    if (inPlace && insideGitTree(d.outDir)) {
      d.log(
        "vercel-build: refused: the closed build replaces the output folder and runs only in the uploaded copy, not in a git working tree",
      );
      return 2;
    }
    /** @type {Buffer} */
    let gateBytes;
    try {
      gateBytes = fs.readFileSync(path.join(d.publicDir, "gate.html"));
    } catch (err) {
      if (/** @type {NodeJS.ErrnoException} */ (err).code !== "ENOENT")
        throw err;
      // The second run of one build on Vercel (spike S1): the first closed run left only the gate page.
      if (inPlace && closedOutput(d.outDir)) {
        d.log(
          "vercel-build: SITE_GATE is set: the output folder already holds only index.html, the bytes of the gate page (an earlier run of this build); nothing changed, no migration",
        );
        return 0;
      }
      // Only an output folder that is public/ itself (the Vercel shape) counts as the output of an earlier
      // run; any other is refused whatever it holds, so its line names that reason, not what it holds.
      d.log(
        inPlace
          ? "vercel-build: refused: SITE_GATE is set, public/gate.html is missing and the output folder is not the closed output of an earlier run"
          : "vercel-build: refused: SITE_GATE is set and public/gate.html is missing; the output folder is not public/ itself, so no earlier run is accepted",
      );
      return 1;
    }
    if (sha256(gateBytes) !== GATE_SHA256) {
      d.log(
        "vercel-build: refused: SITE_GATE is set and public/gate.html does not hold the bytes of the gate page (its sha256 is not GATE_SHA256); nothing changed",
      );
      return 1;
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
