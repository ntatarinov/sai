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
  // The routing is one explicit `routes` table (spike S1). With `framework` null the platform's static
  // builder still picks a framework from package.json; it picked Hono and appended Hono's default
  // `{ "src": "/(.*)", "dest": "/" }` after the rewrites, so every unknown path answered the bytes of
  // index.html with 200. Routes of our own come first: the terminal 404 stands before that rule.
  for (const k of [
    "rewrites",
    "headers",
    "redirects",
    "cleanUrls",
    "trailingSlash",
    "builds",
  ])
    if (k in v) out.push(`no ${k} beside routes`);
  const r = Array.isArray(v.routes) ? v.routes : [];
  if (r.length !== 4) out.push("routes count");
  const head = r[0] ?? {};
  if (
    head.src !== "/(.*)" ||
    head.continue !== true ||
    typeof head.headers !== "object" ||
    head.headers === null ||
    Object.keys(head).sort().join() !== "continue,headers,src"
  )
    out.push("routes: the header rule first, for every path, then continue");
  if (JSON.stringify(r[1]) !== JSON.stringify({ handle: "filesystem" }))
    out.push("routes: the files second");
  if (
    JSON.stringify(r[2]) !==
    JSON.stringify({ src: "^/api(?:/(.*))?$", dest: "/api/index?__p=$1" })
  )
    out.push("routes: one rule to the function");
  if (
    JSON.stringify(r[3]) !==
    JSON.stringify({ src: "/(.*)", status: 404, dest: "/404.html" })
  )
    out.push("routes: the terminal 404 last");
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
      "a rewrite beside the routes",
      (c) =>
        (c.v.rewrites = [
          { source: "/api/:path*", destination: "/api/index?__p=:path*" },
        ]),
      "no rewrites beside routes",
    ],
    [
      "a second rule to the function",
      (c) =>
        c.v.routes.splice(3, 0, { src: "^/x(.*)$", dest: "/api/index?__p=$1" }),
      "routes count",
    ],
    [
      "no terminal 404: unknown paths fall to the platform's later rules",
      (c) => c.v.routes.pop(),
      "routes: the terminal 404 last",
    ],
    [
      "the terminal 404 before the files",
      (c) => c.v.routes.splice(1, 0, c.v.routes.pop()),
      "routes: the files second",
    ],
    [
      "a terminal rule that answers index.html with 200",
      (c) => (c.v.routes[3] = { src: "/(.*)", dest: "/" }),
      "routes: the terminal 404 last",
    ],
    [
      "the header rule without continue",
      (c) => delete c.v.routes[0].continue,
      "routes: the header rule first, for every path, then continue",
    ],
    [
      "the function rule keeps the extra path parameter",
      (c) => (c.v.routes[2].dest = "/api/index?__p=$1&path=$1"),
      "routes: one rule to the function",
    ],
    [
      "a headers key beside the routes",
      (c) => (c.v.headers = []),
      "no headers beside routes",
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
  for (const [name, damage, label] of cases) {
    const c = structuredClone(r);
    damage(c);
    const found = vercelFindings(c.v, c.api, c.tracked, c.ignore);
    assert.notDeepEqual(found, [], name);
    if (label) assert.ok(found.includes(label), `${name}: ${found.join(", ")}`);
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
