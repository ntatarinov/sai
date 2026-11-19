import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { APP, ROOT } from "../fixtures/helpers.js";

// REQ-109 criterion 1. No test runs a Vercel command.

// Folders stand without a trailing slash. Measured at spike S1 (2026-11-19, Vercel CLI 64.1.0): the CLI walks the
// folder and asks its bundled `ignore` 4.0.6 about every entry by its relative name, a folder as "api", never "api/".
// "/*" then "!api/" leaves that name ignored, so the walk skips the folder: the upload held only the four root files
// and the build stopped with «The pattern "api/index.js" defined in `functions` doesn't match any Serverless
// Functions inside the `api` directory». "!api" keeps the folder and every file under it.
const KEEP = [
  "api",
  "server",
  "public",
  "content",
  "scripts",
  "db",
  "package.json",
  "package-lock.json",
  ".npmrc",
  "vercel.json",
];

/** @param {any} v @param {string[]} apiFiles @param {string[]} tracked @param {string} ignore */
export function vercelFindings(v, apiFiles, tracked, ignore) {
  const out = [];
  if (v.framework !== null) out.push("framework");
  if (v.buildCommand !== "npm run vercel-build") out.push("buildCommand");
  if (v.outputDirectory !== "public") out.push("outputDirectory");
  if (JSON.stringify(v.regions) !== '["fra1"]') out.push("regions");
  const fk = Object.keys(v.functions ?? {});
  if (
    fk.length !== 1 ||
    fk[0] !== "api/index.js" ||
    v.functions["api/index.js"].maxDuration !== 30
  )
    out.push("functions");
  if (
    JSON.stringify(v.rewrites) !==
    JSON.stringify([
      { source: "/api/:path*", destination: "/api/index?__p=:path*" },
    ])
  )
    out.push("rewrites");
  if (JSON.stringify(apiFiles) !== '["index.js"]') out.push("app/api files");
  if (tracked.some((f) => f.includes("["))) out.push("a [ in a tracked name");
  const lines = ignore
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
  if (lines[0] !== "/*") out.push("allowlist start");
  if (lines.some((l) => l.startsWith("!") && l.endsWith("/")))
    out.push("allowlist folder with a trailing slash");
  const kept = lines.filter((l) => l.startsWith("!")).map((l) => l.slice(1));
  if (
    JSON.stringify([...kept].sort()) !== JSON.stringify([...KEEP].sort()) ||
    lines.length !== KEEP.length + 1
  )
    out.push("allowlist entries");
  return out;
}

const real = () => ({
  v: JSON.parse(fs.readFileSync(path.join(APP, "vercel.json"), "utf8")),
  api: fs.readdirSync(path.join(APP, "api")).sort(),
  tracked: execFileSync("git", ["ls-files", "app"], {
    cwd: ROOT,
    encoding: "utf8",
  })
    .split("\n")
    .filter(Boolean),
  ignore: fs.readFileSync(path.join(APP, ".vercelignore"), "utf8"),
});

test("VC-1 the real Vercel files keep every rule", () => {
  const r = real();
  assert.deepEqual(vercelFindings(r.v, r.api, r.tracked, r.ignore), []);
});

test("VC-2 each damaged copy is red", () => {
  const r = real();
  const cases = [
    [
      "a second function",
      (c) => (c.v.functions["api/other.js"] = { maxDuration: 30 }),
    ],
    ["a [...path].js file", (c) => c.tracked.push("app/api/[...path].js")],
    [
      "a second rewrite",
      (c) => c.v.rewrites.push({ source: "/x", destination: "/y" }),
    ],
    ["another region", (c) => (c.v.regions = ["iad1"])],
    [
      "a missing allowlist entry",
      (c) => (c.ignore = c.ignore.replace("!db\n", "")),
    ],
    [
      "a folder kept with a trailing slash, as before spike S1",
      (c) => (c.ignore = c.ignore.replace("!api\n", "!api/\n")),
    ],
    [
      "every folder kept with a trailing slash",
      (c) =>
        (c.ignore = c.ignore.replace(
          /^!(api|server|public|content|scripts|db)$/gm,
          "!$1/",
        )),
    ],
    ["a second file in app/api", (c) => c.api.push("x.js")],
    [
      "an allowlist that does not start with /*",
      (c) => (c.ignore = c.ignore.replace("\n/*\n", "\n/x\n")),
    ],
  ];
  for (const [name, damage] of cases) {
    const c = structuredClone(r);
    damage(c);
    assert.notDeepEqual(
      vercelFindings(c.v, c.api, c.tracked, c.ignore),
      [],
      name,
    );
  }
});

test("VC-3 a kept folder with a trailing slash is red by its own rule, also beside the list of names", () => {
  const r = real();
  const slashed = r.ignore.replace(
    /^!(api|server|public|content|scripts|db)$/gm,
    "!$1/",
  );
  assert.notEqual(slashed, r.ignore, "the damage changed the text");
  const found = vercelFindings(r.v, r.api, r.tracked, slashed);
  assert.ok(
    found.includes("allowlist folder with a trailing slash"),
    found.join(", "),
  );
  assert.ok(
    !vercelFindings(r.v, r.api, r.tracked, r.ignore).includes(
      "allowlist folder with a trailing slash",
    ),
  );
});
